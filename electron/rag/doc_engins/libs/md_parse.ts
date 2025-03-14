import { IMAGE_SAVE_PATH, IMAGE_URL_LAST } from '../utils';
import { pub } from '../../../class/public';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

// 类型定义
interface ImageItem {
  originalSrc: string;
  newPath: string;
  newUrl: string;
}

/**
 * Markdown解析器类
 */
export class MdParser {
  private filename: string;
  private ragName:string;
  private baseDocName: string;
  private imageIndex: number = 0;
  private content: string = '';
  private images: ImageItem[] = [];
  
  /**
   * 构造函数
   * @param filename Markdown文件路径
   */
  constructor(filename: string,ragName:string) {
    this.filename = filename;
    this.ragName = ragName;
    this.baseDocName = path.basename(filename, path.extname(filename));
  }
  
  /**
   * 读取Markdown文件内容
   * @returns 是否成功读取
   */
  private readFile(): boolean {
    try {
      this.content = fs.readFileSync(this.filename, 'utf8');
      return true;
    } catch (error) {
      console.error('读取Markdown文件失败:', error);
      return false;
    }
  }
  
  /**
   * 保存图片
   * @param src 图片URL或本地路径
   * @returns 保存后的图片路径和URL
   */
  private async saveImage(src: string): Promise<ImageItem | null> {
    try {
      // 创建图片保存目录
      const outputDir = path.join(IMAGE_SAVE_PATH, 'md');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // 处理不同类型的图片源
      let imageData: Buffer;
      let ext = '.png'; // 默认扩展名
      
      if (src.startsWith('data:')) {
        // 处理Base64编码的图片
        const matches = src.match(/^data:image\/([a-zA-Z0-9]+);base64,(.*)$/);
        if (!matches) return null;
        
        const imageType = matches[1];
        const base64Data = matches[2];
        ext = `.${imageType}`;
        imageData = Buffer.from(base64Data, 'base64');
      } else if (src.startsWith('http')) {
        // 处理远程图片
        const response = await fetch(src);
        if (!response.ok) return null;
        
        imageData = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type');
        if (contentType) {
          const imageType = contentType.split('/')[1];
          ext = `.${imageType}`;
        }
      } else {
        // 处理本地图片
        const imagePath = path.isAbsolute(src) ? src : path.join(path.dirname(this.filename), src);
        if (!fs.existsSync(imagePath)) return null;
        
        imageData = fs.readFileSync(imagePath);
        ext = path.extname(imagePath);
      }
      
      // 创建唯一图片名
      const uniqueImageName = `${pub.md5(`${this.baseDocName}_${this.imageIndex++}`)}${ext}`;
    const imagePath = path.join(outputDir, this.ragName, 'images', uniqueImageName);
    if(pub.file_exists(imagePath)) pub.mkdir(imagePath);
    const imageUrl = `${IMAGE_URL_LAST}/images?r=${this.ragName}&n=${uniqueImageName}`;
      
      // 保存图片
      fs.writeFileSync(imagePath, imageData);
      
      return {
        originalSrc: src,
        newPath: imagePath,
        newUrl: imageUrl
      };
    } catch (error) {
      console.error('保存图片失败:', error);
      return null;
    }
  }
  
  /**
   * 处理Markdown中的图片引用
   */
  private async processImages(): Promise<void> {
    if(this.ragName == 'temp') return;
    // 匹配Markdown中的图片引用 ![alt](url)
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    
    // 收集所有图片引用
    const imagesToProcess:any[] = [];
    while ((match = imageRegex.exec(this.content)) !== null) {
      const alt = match[1];
      const src = match[2];
      
      imagesToProcess.push({
        alt,
        src,
        fullMatch: match[0],
        index: match.index
      });
    }
    
    // 处理每个图片
    for (const img of imagesToProcess) {
      const savedImage = await this.saveImage(img.src);
      if (savedImage) {
        this.images.push(savedImage);
        
        // 替换原始图片引用
        const newImageMarkdown = `![${img.alt}](${savedImage.newUrl})`;
        this.content = this.content.replace(img.fullMatch, newImageMarkdown);
      }
    }
  }
  
  /**
   * 解析Markdown文件
   * @returns 处理后的Markdown内容
   */
  public async parse(): Promise<string> {
    if (!this.readFile()) {
      return '';
    }
    
    await this.processImages();
    return this.content;
  }
  
  /**
   * 清理资源
   */
  public dispose(): void {
    this.content = '';
    this.images = [];
  }
}

/**
 * 开始解析(此函数为统一入口，其它同类模块也使用此函数名作为入口)
 * @param filename Markdown文件路径
 * @returns 处理后的Markdown内容
 */
export async function parse(filename: string,ragName:string): Promise<string> {
  try {
    const parser = new MdParser(filename,ragName);
    const markdown = await parser.parse();
    parser.dispose(); // 释放资源
    return markdown;
  } catch (error) {
    console.error('解析Markdown失败:', error);
    return '';
  }
}