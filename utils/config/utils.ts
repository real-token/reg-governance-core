import fs from "fs";

export function writeJson(fileNamePath: string, data: any) {
  // Check if the file already exists
  if (fs.existsSync(`${fileNamePath}`)) {
    console.log(
      `REMIND: The file ${fileNamePath} already exists, please check to avoid OVERWRITING it!!!`
    );
    process.exit(0);
  } else {
    fs.writeFile(
      `${fileNamePath}`,
      JSON.stringify(data, null, 2),
      "utf8",
      function (err) {
        if (err) throw err;
        console.log(`File written succesfully to JSON file: ${fileNamePath}`);
      }
    );
  }
}
