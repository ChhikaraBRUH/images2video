import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import fs from "fs";
import downloadImage from "./downloadImage.js";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);
const port = 3000;

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("iamges2video express server is running");
});

app.post("/video", async (req, res) => {
  const { imageUrls } = req.body;

  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls?.length === 0) {
    return res.status(400).json({ error: "Invalid imageUrls." });
  }

  const timeStart = new Date().getTime();
  const outputFileName = "/tmp/output.mp4";
  const imageFiles = [];

  // Download images
  let downloadPromises = imageUrls.map((url, i) => {
    const fileName = `/tmp/image${i}`;
    return downloadImage(url, fileName)
      .then(() => imageFiles.push(fileName))
      .catch((error) => {
        console.log("Error downloading image", error);
        throw new Error("Error downloading image.");
      });
  });

  await Promise.all(downloadPromises)
    .then(() => {
      // Sort image files by name
      imageFiles.sort((a, b) => {
        const aNumber = parseInt(a.replace("image", ""));
        const bNumber = parseInt(b.replace("image", ""));
        return aNumber - bNumber;
      });
    })
    .catch((error) => {
      console.log("Error downloading images", error);
      return res.status(500).json({ error: "Error downloading images." });
    });

  const ffmpegInstance = ffmpeg();

  ffmpegInstance
    .input("concat:" + imageFiles.join("|"))
    .inputFormat("image2pipe")
    .inputFPS(1 / 5) // 5 seconds per image
    .output(outputFileName)
    .on("start", (commandLine) => {
      console.log("ffmpeg process started:", commandLine);
    })
    .on("end", () => {
      const timeEnd = new Date().getTime();
      console.log(`Video generation took ${timeEnd - timeStart} ms`);

      // Send the video file as a response
      res.download(outputFileName, (err) => {
        if (err) {
          return res.status(500).json({ error: "Error sending video file." });
        }

        // Clean up: remove the generated video file
        fs.unlinkSync(outputFileName);
      });

      // Clean up: remove temporary image files
      imageFiles.forEach((fileName) => fs.unlinkSync(fileName));
    })
    .on("error", (err) => {
      console.log("Error generating video", err);
      return res.status(500).json({ error: "Error generating video." });
    })
    .run();
});

app.listen(port, () => {
  console.log(`👾 Express Server is running at http://localhost:${port}`);
});
