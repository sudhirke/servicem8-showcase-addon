import { ServiceM8 } from "servicem8";
import * as dotenv from "dotenv";
dotenv.config();

exports.sm8Client = new ServiceM8({
  security: {
    apiKey: process.env["SERVICEM8_API_KEY"] ?? "",
  },
});
