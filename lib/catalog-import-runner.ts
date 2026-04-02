import { API_OBJECT_TYPES, buildUploadPayload, getUploadSequence } from "./file-uploader";
import {
  calculateETA,
  getAdaptiveInterval,
  isTerminalStatus,
  MAX_POLL_DURATION_MS,
} from "./import-poller";
import type { ImportFileState, OutputCSVs } from "./types";

interface TokenContext {
  apiBaseUrl: string;
  token: string;
}

interface ImportReportJob {
  id: string;
  name: string;
  status: string;
  totalRows: number | null;
  countProcessed: number;
  countError: number;
}

interface CatalogImportSendMessage {
  (
    type: "getPresignedUrl",
    data: {
      apiBaseUrl: string;
      token: string;
      params: {
        name: string;
        contentLength: number;
        objectType: string;
        objectId: string;
      };
    },
  ): Promise<{ presignedUrl: string }>;
  (
    type: "uploadToS3",
    data: {
      presignedUrl: string;
      csvContent: string;
      contentLength: number;
    },
  ): Promise<{ ok: boolean; error?: string }>;
  (
    type: "fetchImportReport",
    data: { apiBaseUrl: string; token: string },
  ): Promise<ImportReportJob[]>;
}

interface CatalogImportRunnerOptions {
  csvs: OutputCSVs;
  initialFileStates: ImportFileState[];
  resumeFromIndex?: number;
  startTime?: number;
  getTokenAndUrl: () => Promise<TokenContext>;
  sendMessage: CatalogImportSendMessage;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  isCancelled?: () => boolean;
  onFileStatesChange: (fileStates: ImportFileState[]) => void;
  onCurrentFileIndexChange: (index: number) => void;
  onEtaChange: (eta: string) => void;
}

type CatalogImportRunnerResult =
  | { ok: true; fileStates: ImportFileState[]; totalImported: number }
  | { ok: false; fileStates: ImportFileState[]; failedFileIndex: number; errorMessage: string };

function cloneStates(states: ImportFileState[]): ImportFileState[] {
  return states.map((state) => ({ ...state }));
}

export async function runCatalogImportSequence({
  csvs,
  initialFileStates,
  resumeFromIndex = 0,
  startTime = Date.now(),
  getTokenAndUrl,
  sendMessage,
  now = () => new Date(),
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  isCancelled = () => false,
  onFileStatesChange,
  onCurrentFileIndexChange,
  onEtaChange,
}: CatalogImportRunnerOptions): Promise<CatalogImportRunnerResult> {
  const states = cloneStates(initialFileStates);
  const sequence = getUploadSequence(csvs);
  const sequenceKeys = sequence.map((file) => file.key);

  onFileStatesChange(cloneStates(states));

  for (let i = 0; i < states.length; i++) {
    const fileKey = states[i].key;
    const sequenceIndex = sequenceKeys.indexOf(fileKey);

    if (sequenceIndex === -1) {
      states[i] = { ...states[i], status: "done", processedCount: 0, rowCount: 0 };
      onFileStatesChange(cloneStates(states));
      continue;
    }

    if (i < resumeFromIndex && states[i].status === "done") continue;
    if (isCancelled()) break;

    onCurrentFileIndexChange(i);
    const file = sequence[sequenceIndex];
    const timestamp = now();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const fileName = `${file.label} - ${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}-${pad(timestamp.getHours())}-${pad(timestamp.getMinutes())}.csv`;

    try {
      const { apiBaseUrl, token } = await getTokenAndUrl();
      const objectType = API_OBJECT_TYPES[file.key];
      const { csvContent, contentLength } = buildUploadPayload(file.data, fileName);

      states[i] = { ...states[i], status: "uploading" };
      onFileStatesChange(cloneStates(states));

      const { presignedUrl } = await sendMessage("getPresignedUrl", {
        apiBaseUrl,
        token,
        params: { name: fileName, contentLength, objectType, objectId: objectType },
      });

      const uploadResult = await sendMessage("uploadToS3", {
        presignedUrl,
        csvContent,
        contentLength,
      });
      if (!uploadResult.ok) throw new Error(uploadResult.error ?? "S3 upload failed");

      states[i] = { ...states[i], status: "processing" };
      onFileStatesChange(cloneStates(states));

      const totalRows = file.data.length - 1;
      const interval = getAdaptiveInterval(totalRows);
      const pollStart = Date.now();
      let jobId: string | null = null;

      while (true) {
        if (isCancelled()) break;
        if (Date.now() - pollStart > MAX_POLL_DURATION_MS) {
          throw new Error(`Import timed out after 60 minutes for ${file.label}`);
        }

        await wait(interval);

        const { apiBaseUrl: pollApiUrl, token: pollToken } = await getTokenAndUrl();
        const jobs = await sendMessage("fetchImportReport", {
          apiBaseUrl: pollApiUrl,
          token: pollToken,
        });

        const job: ImportReportJob | undefined = jobId
          ? jobs.find((entry) => entry.id === jobId)
          : jobs.find((entry) => entry.name === fileName);

        if (!job) continue;
        if (!jobId) jobId = job.id;

        states[i] = {
          ...states[i],
          processedCount: job.countProcessed,
          errorCount: job.countError,
          rowCount: job.totalRows ?? states[i].rowCount,
        };
        onFileStatesChange(cloneStates(states));

        const completedSoFar = states.filter(
          (state, index) =>
            index < i && (state.status === "done" || state.status === "done_with_warnings"),
        ).length;
        const fileProgress = job.totalRows ? job.countProcessed / job.totalRows : 0;
        onEtaChange(calculateETA(startTime, completedSoFar, states.length, fileProgress));

        const allProcessed =
          job.totalRows != null && job.totalRows > 0 && job.countProcessed >= job.totalRows;

        if (isTerminalStatus(job.status) || allProcessed) {
          if (job.status === "FINISHED_WITH_FAILURES") {
            states[i] = { ...states[i], status: "done_with_warnings" };
          } else if (job.status === "FINISHED" || allProcessed) {
            states[i] = { ...states[i], status: "done" };
          } else {
            throw new Error(
              `Import stopped early for ${file.label}: ${job.status} (${job.countError} errors)`,
            );
          }
          onFileStatesChange(cloneStates(states));
          break;
        }
      }
    } catch (err) {
      if (isCancelled()) break;
      const message = err instanceof Error ? err.message : "Import failed";
      states[i] = { ...states[i], status: "failed", error: message };
      onFileStatesChange(cloneStates(states));
      return {
        ok: false,
        fileStates: states,
        failedFileIndex: i,
        errorMessage: `${states[i]?.label ?? "File"} failed: ${message}`,
      };
    }
  }

  const totalImported = states.reduce((sum, file) => {
    if (file.status === "done" || file.status === "done_with_warnings") {
      return sum + file.processedCount;
    }
    return sum;
  }, 0);

  onCurrentFileIndexChange(-1);

  return {
    ok: true,
    fileStates: states,
    totalImported,
  };
}
