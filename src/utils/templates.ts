import ejs from "ejs";
import path from "path";

import config from "../config";

export function renderTemplate(
  templateName: string,
  data: object,
): Promise<string> {
  const templatePath = path.join(
    __dirname,
    config.TEMPLATE_PATH,
    `${templateName}.ejs`,
  );

  return ejs.renderFile(templatePath, data);
}
