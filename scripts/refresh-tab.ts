import { refreshTabData } from "../src/lib/data/engine";

const tab = process.argv[2] ?? "economic";
const scope = process.argv[3] === "all" ? "all" : "critical";

refreshTabData(tab, scope)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
