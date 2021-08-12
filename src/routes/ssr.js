import express from "express";
import chromium from "chrome-aws-lambda";
import { PDFDocument } from "pdf-lib";
import App from "../components/app";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const router = express.Router();

router.get("/", async (request, res) => {
  let data = {};
  let project = {};
  let thumbnail = {};
  let pdfCollection = [];
  const { template } = request.body || {};
  const browser = await chromium.puppeteer.launch({
    headless: true,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  });

  const mergedPdf = await PDFDocument.create();

  const templateNode = [{ component: App, props: {} }];
  if (templateNode?.length) {
    const newArray = templateNode.map(async (node) => {
      const browserPage = await browser.newPage();
      const content = renderToStaticMarkup(
        React.createElement(node.component, {
          ...node.props,
        })
      );
      const { isCover } = node.props;

      await browserPage.setContent(content);
      const bufferItem = await browserPage.pdf({ printBackground: true });
      await browserPage.close();
      return bufferItem;
    });
    pdfCollection = await Promise.all(newArray);
  }

  const [coverPage] = pdfCollection.splice(0, 1);

  for (const pdfBytes of pdfCollection) {
    const pdf = await PDFDocument.load(pdfBytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    for (const page of copiedPages) {
      await mergedPdf.addPage(page);
    }
  }

  const buffer = await mergedPdf.save();

  return res.send(buffer);
});

export default router;
