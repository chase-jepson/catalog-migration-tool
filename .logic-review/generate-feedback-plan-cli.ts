import { main } from "./generate-feedback-plan";

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
