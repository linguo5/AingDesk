import { IMAGE_SAVE_PATH, IMAGE_URL_LAST } from '../utils';
import { pub } from '../../../class/public';
import * as pdfjsLib from 'pdfjs-dist';
import * as path from 'path';
import * as fs from 'fs';
import * as canvas from 'canvas';

// 类型定义
interface ImageItem {
  originalRef: string;
  newPath: string;
  newUrl: string;
  pageNumber: number;
  index: number;
}

// 封装错误处理和日志记录
const logError = (message: string, error: any) => {
  console.error(`${message}:`, error);
};

// 确保目录存在
const ensureDirectoryExists = (dir: string) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (dirError) {
    logError(`创建目录失败 ${dir}`, dirError);
    const absPath = path.resolve(dir);
    if (!fs.existsSync(absPath)) {
      fs.mkdirSync(absPath, { recursive: true });
    }
  }
};

// 处理图像数据
const processImageData = (img: any, imgWidth: number, imgHeight: number) => {
  const imgCanvas = canvas.createCanvas(imgWidth, imgHeight);
  const imgCtx = imgCanvas.getContext('2d');
  const imgData = imgCtx.createImageData(imgWidth, imgHeight);

  if (img.kind === 'RGBA_32BPP') {
    imgData.data.set(img.data);
  } else if (img.kind === 'RGB_24BPP') {
    for (let p = 0, q = 0; p < img.data.length; p += 3, q += 4) {
      imgData.data[q] = img.data[p];
      imgData.data[q + 1] = img.data[p + 1];
      imgData.data[q + 2] = img.data[p + 2];
      imgData.data[q + 3] = 255;
    }
  } else if (img.kind === 'GRAY_8BPP') {
    for (let p = 0, q = 0; p < img.data.length; p++, q += 4) {
      imgData.data[q] = img.data[p];
      imgData.data[q + 1] = img.data[p];
      imgData.data[q + 2] = img.data[p];
      imgData.data[q + 3] = 255;
    }
  } else {
    for (let p = 0, q = 0; p < img.data.length && q < imgData.data.length; p++, q += 4) {
      imgData.data[q] = img.data[p];
      imgData.data[q + 1] = img.data[Math.min(p + 1, img.data.length - 1)];
      imgData.data[q + 2] = img.data[Math.min(p + 2, img.data.length - 1)];
      imgData.data[q + 3] = 255;
    }
  }

  imgCtx.putImageData(imgData, 0, 0);
  return imgCanvas.toBuffer('image/png');
};

/**
 * PDF解析器类
 */
export class PdfParser {
  private filename: string;
  private ragName: string;
  private baseDocName: string;
  private pdfDocument: pdfjsLib.PDFDocumentProxy | null = null;
  private images: ImageItem[] = [];
  private imageIndex: number = 0;

  /**
   * 构造函数
   * @param filename PDF文件路径
   */
  constructor(filename: string, ragName: string) {
    this.filename = filename;
    this.ragName = ragName;
    this.baseDocName = path.basename(filename, path.extname(filename));
  }

  /**
   * 初始化PDF.js和加载文档
   * @returns 是否成功初始化
   */
  private async initPdfDocument(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.filename)) {
        logError(`文件不存在`, this.filename);
        return false;
      }

      try {
        const testCanvas = canvas.createCanvas(10, 10);
        const ctx = testCanvas.getContext('2d');
        ctx.fillRect(0, 0, 10, 10);
      } catch (canvasErr: any) {
        throw new Error(`无法使用canvas库: ${canvasErr.message}`);
      }

      // const pdfjsPath = path.dirname(require.resolve('pdfjs-dist/package.json'));
      // const workerPath = path.join(pdfjsPath, 'build', 'pdf.worker.js');

      // if (fs.existsSync(workerPath)) {
      //   pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
      // } else {
      //   console.warn(`找不到worker文件: ${workerPath}, PDF.js可能无法正常工作`);
      // }

      const data = new Uint8Array(fs.readFileSync(this.filename));
      const loadingTask = pdfjsLib.getDocument({ data });
      this.pdfDocument = await loadingTask.promise;

      return true;
    } catch (error) {
      logError('初始化PDF文档失败', error);
      return false;
    }
  }

  /**
   * 保存从PDF中提取的图像
   * @param imageData 图像数据
   * @param pageNumber 页码
   * @param index 图像索引
   * @returns 图像保存信息
   */
  private async saveImage(
    imageData: Uint8Array | Buffer,
    pageNumber: number,
    index: number,
  ): Promise<ImageItem | null> {
    try {
      if (!imageData || imageData.length === 0) {
        return null;
      }

      const outputDir = IMAGE_SAVE_PATH;
      const fullOutputDir = path.join(outputDir, this.ragName, 'images');
      ensureDirectoryExists(fullOutputDir);

      const uniqueImageName = `${pub.md5(`${this.baseDocName}_page${pageNumber}_img${index}`)}.png`;
      const imagePath = path.join(fullOutputDir, uniqueImageName);
      if(pub.file_exists(imagePath)) pub.mkdir(imagePath);
      const imageUrl = `${IMAGE_URL_LAST}/images?r=${this.ragName}&n=${uniqueImageName}`;

      const buffer = Buffer.isBuffer(imageData) ? imageData : Buffer.from(imageData);
      fs.writeFileSync(imagePath, buffer);
      
      return {
        originalRef: `page${pageNumber}_img${index}`,
        newPath: imagePath,
        newUrl: imageUrl,
        pageNumber,
        index
      };
    } catch (error) {
      logError(`保存图像失败`, error);
      return null;
    }
  }

  /**
   * 提取一个页面的图像
   * @param page PDF页面
   * @param pageNumber 页码
   * @returns 页面中的图像项
   */
  private async extractPageImages(page: pdfjsLib.PDFPageProxy, pageNumber: number): Promise<ImageItem[] | null> {
    if(this.ragName == 'temp') return null;
    const pageImages: ImageItem[] = [];

    try {
      const ops = await page.getOperatorList();
      const commonObjs = page.commonObjs;
      const objs = page.objs;

      const imageOperators = [
        pdfjsLib.OPS.paintImageXObject,
        pdfjsLib.OPS.paintImageXObjectRepeat,
        pdfjsLib.OPS.paintJpegXObject
      ];

      const processedImgRefs = new Set();
      const imageTransforms = new Map();

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fnId = ops.fnArray[i];
        const args = ops.argsArray[i];

        if (fnId === pdfjsLib.OPS.setTransform) {
          const transformMatrix = args;
          if (i + 1 < ops.fnArray.length && imageOperators.includes(ops.fnArray[i + 1])) {
            const imgRef = ops.argsArray[i + 1][0];
            imageTransforms.set(imgRef, transformMatrix);
          }
        }
      }

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fnId = ops.fnArray[i];
        const args = ops.argsArray[i];

        if (imageOperators.includes(fnId)) {
          const imgRef = args[0];

          if (processedImgRefs.has(imgRef)) {
            continue;
          }
          processedImgRefs.add(imgRef);

          try {
            const img = objs.get(imgRef) || commonObjs.get(imgRef);

            if (img) {
              const imgWidth = img.width;
              const imgHeight = img.height;

              if (imgWidth < 20 || imgHeight < 20) {
                continue;
              }

              let imageData;

              if (img.data) {
                imageData = processImageData(img, imgWidth, imgHeight);
              } else if (img.getImageData) {
                try {
                  const imgData = img.getImageData();
                  const imgCanvas = canvas.createCanvas(imgWidth, imgHeight);
                  const imgCtx = imgCanvas.getContext('2d');
                  imgCtx.putImageData(imgData, 0, 0);
                  imageData = imgCanvas.toBuffer('image/png');
                } catch (e) {
                  logError(`无法通过getImageData获取图像数据`, e);
                }
              } else {
                try {
                  const imgCanvas = canvas.createCanvas(imgWidth, imgHeight);
                  const imgCtx = imgCanvas.getContext('2d');

                  if (typeof img.drawImage === 'function') {
                    img.drawImage(imgCtx, 0, 0, imgWidth, imgHeight);
                    imageData = imgCanvas.toBuffer('image/png');
                  } else {
                    continue;
                  }
                } catch (renderErr) {
                  logError(`渲染图像 ${imgRef} 失败`, renderErr);
                  continue;
                }
              }

              if (imageData && imageData.length > 0) {
                const savedImage = await this.saveImage(imageData, pageNumber, this.imageIndex++);
                if (savedImage) {
                  pageImages.push(savedImage);
                }
              }
            } else {
              console.log(`没有找到图像对象: ${imgRef}`);
            }
          } catch (imgError) {
            logError(`处理图像 ${imgRef} 时出错`, imgError);
          }
        }
      }
    } catch (error) {
      logError(`提取页面 ${pageNumber} 图像时出错`, error);
    }

    return pageImages;
  }

  /**
   * 提取一个页面的文本内容
   * @param page PDF页面
   * @returns 页面文本内容
   */
  private async extractPageText(page: pdfjsLib.PDFPageProxy): Promise<string> {
    const textContent = await page.getTextContent();
    let lastY;
    let textChunks: string[] = [];
    let currentChunk = '';

    const sanitizeText = (text: string) => {
      return text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
    };

    for (const item of textContent.items) {
      if (lastY !== undefined && Math.abs(lastY - item.transform[5]) > 3) {
        if (currentChunk) {
          textChunks.push(sanitizeText(currentChunk));
          currentChunk = '';
        }
      }
      currentChunk += item.str;
      lastY = item.transform[5];
    }

    if (currentChunk) {
      textChunks.push(sanitizeText(currentChunk));
    }
    const pageText = textChunks.join('\n');
    return pageText;
  }

  /**
   * 解析PDF文件
   * @returns Markdown格式的内容
   */
  public async parse(): Promise<string> {
    if (!(await this.initPdfDocument()) || !this.pdfDocument) {
      return '';
    }

    let markdownContent: string[] = [];
    markdownContent.push(`# ${this.baseDocName}\n`);

    const numPages = this.pdfDocument.numPages;

    const pagePromises = Array.from({ length: numPages }, async (_, pageIndex) => {
      const pageNum = pageIndex + 1;
      try {
        const page = await this.pdfDocument!.getPage(pageNum);

        const pageText = await this.extractPageText(page);
        if (pageText) {
          markdownContent.push(pageText);
          markdownContent.push('\n');
        }

        const pageImages = await this.extractPageImages(page, pageNum);
        this.images.push(...pageImages);

        if (pageImages.length > 0) {
          pageImages.forEach((image, idx) => {
            markdownContent.push(`![IMG ${idx + 1}](${image.newUrl})\n`);
          });
        }
      } catch (pageError) {
        logError(`处理页面 ${pageNum} 失败`, pageError);
        markdownContent.push(`无法处理此页面内容，发生错误。\n`);
      }
      markdownContent.push('\n');
    });

    await Promise.all(pagePromises);

    this.dispose();

    return markdownContent.join('\n');
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.pdfDocument) {
      this.pdfDocument.destroy();
      this.pdfDocument = null;
    }
    this.images = [];
  }
}

/**
 * 将 PDF 文件解析并转换为 Markdown 格式
 * @param filename PDF 文件路径
 * @returns Markdown 格式的字符串
 */
export async function parse(filename: string, ragName: string): Promise<string> {
  try {
    const parser = new PdfParser(filename, ragName);
    const markdown = await parser.parse();
    return markdown;
  } catch (error) {
    logError('解析 PDF 文件失败', error);
    return '';
  }
}