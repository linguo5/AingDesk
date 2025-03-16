import { pub } from "../class/public";
import * as path from "path";
import * as fs from "fs";
import { Rag } from "../rag/rag";
import { LanceDBManager } from "../rag/vector_database/vector_lancedb";
import { GetSupplierEmbeddingModels } from "../service/model";

// 知识库保存路径
const RAG_PATH = pub.get_data_path() + "/rag";

/**
 * rag controller 类，负责管理知识库的相关操作
 * @class
 */
class RagController {
  /**
   * 获取知识库状态
   * @returns {Promise<any>} - 知识库状态
   */
  async rag_status() {
    try {
      // 检查是否有嵌套模型
      let result = await GetSupplierEmbeddingModels();
      if (Object.keys(result).length > 0) {
        return pub.return_success(pub.lang("知识库组件正常"));
      }
      return pub.return_error(pub.lang("请选安装或接入嵌入模型"));
    } catch (e: any) {
      return pub.return_error(pub.lang("请选安装或接入嵌入模型"), e.message);
    }
  }

  /**
   * 获取嵌套模型列表
   * @returns {Promise<any>} - 嵌套模型列表
   */
  async get_embedding_models() {
    let result = await GetSupplierEmbeddingModels();
    return pub.return_success(pub.lang("获取成功"), result);
  }

  /**
   * 创建知识库
   * @param {string} ragName - 知识库名称
   * @param {string} ragDesc - 知识库描述
   * @returns {Promise<any>} - 创建结果
   */
  async create_rag(args: { ragName: string; ragDesc: string; enbeddingModel?: string; supplierName?: string }): Promise<any> {
    // logger.info("create rag");

    // 检查参数
    if (!args.ragName) {
      return pub.return_error(pub.lang("知识库名称不能为空"));
    }

    if (args.ragName == "vector_db") {
      return pub.return_error(pub.lang("知识库名称不能为vector_db"));
    }

    if (!args.enbeddingModel) {
      args.enbeddingModel = "bge-m3:latest";
    }

    if (!args.supplierName) {
      args.supplierName = "ollama";
    }

    // 知识库保存路径
    const ragPath = RAG_PATH + "/" + args.ragName;

    // 检查知识库是否存在
    if (pub.file_exists(ragPath)) {
      return pub.return_error(pub.lang("指定知识库名称已存在"));
    }

    // 创建知识库目录
    pub.mkdir(ragPath);

    // 创建知识库描述文件
    const ragDescFile = ragPath + "/config.json";
    let pdata = {
      ragName: args.ragName, // 知识库名称
      ragDesc: args.ragDesc, // 知识库描述
      ragCreateTime: pub.time(), // 创建时间
      supplierName: args.supplierName, // 嵌套模型供应商名称
      embeddingModel: args.enbeddingModel, // 嵌套模型
      searchStrategy: 1, // 检索策略 1=混合检索 2=向量检索 3=全文检索
      maxRecall: 10, // 最大召回数
      recallAccuracy: 0.1, // 召回精度
      resultReordering: 1, // 结果重排序 1=开启 0=关闭  PS: 目前仅语义重排
      rerankModel: "", // 重排序模型 PS: 未实现
      queryRewrite: 0, // 查询重写 1=开启 0=关闭   PS: 未实现
      vectorWeight: 0.7, // 向量权重
      keywordWeight: 0.3, // 关键词权重
    };
    pub.write_file(ragDescFile, JSON.stringify(pdata, null, 4));

    // 创建知识库原始文件目录
    pub.mkdir(ragPath + "/source");

    // 创建知识库markdown文件目录
    pub.mkdir(ragPath + "/markdown");

    // 创建图片目录
    pub.mkdir(ragPath + "/images");

    return pub.return_success(pub.lang("知识库创建成功"));
  }

  /**
   * 删除知识库
   * @param {string} ragName - 知识库名称
   * @returns {Promise<any>} - 删除结果
   */
  async remove_rag(args: { ragName: string }): Promise<any> {
    // logger.info("delete rag");
    if (args.ragName == "vector_db") {
      return pub.return_error(pub.lang("知识库名称不能为vector_db"));
    }
    // 检查参数
    if (!args.ragName) {
      return pub.return_error(pub.lang("知识库名称不能为空"));
    }

    // 知识库保存路径
    const ragPath = RAG_PATH + "/" + args.ragName;

    // 检查知识库是否存在
    if (!pub.file_exists(ragPath)) {
      return pub.return_error(pub.lang("知识库不存在"));
    }

    // 删除知识库所有文档和向量索引
    let ragObj = new Rag();
    ragObj.removeRag(args.ragName);

    // 删除知识库文件
    pub.rmdir(ragPath);

    // 删除知识库索引标记
    const indexTipFile = path.join(pub.get_data_path(), "rag", "index_tips", pub.md5(args.ragName) + ".pl");
    if (pub.file_exists(indexTipFile)) {
      fs.unlinkSync(indexTipFile);
    }

    return pub.return_success(pub.lang("知识库删除成功"));
  }

  /**
   * 获取知识库列表
   * @returns {Promise<any>} - 知识库列表
   */
  async get_rag_list(): Promise<any> {
    // logger.info("get rag list");

    // 获取知识库列表
    const ragPathList = pub.readdir(RAG_PATH);

    const ragList: any[] = [];
    for (const ragPath of ragPathList) {
      const ragDescFile = ragPath + "/config.json";
      if (pub.file_exists(ragDescFile)) {
        const ragDesc = JSON.parse(pub.read_file(ragDescFile));

        // 补全缺失字段
        if (!ragDesc.vectorWeight) {
          ragDesc.ragCreateTime = pub.time(); // 创建时间
          ragDesc.embeddingModel = "bge-m3:latest"; // 嵌套模型
          ragDesc.searchStrategy = 1; // 检索策略 1=混合检索 2=向量检索 3=全文检索
          ragDesc.maxRecall = 5; // 最大召回数
          ragDesc.recallAccuracy = 0.1; // 召回精度
          ragDesc.resultReordering = 1; // 结果重排序 1=开启 0=关闭 PS: 目前仅语义重排
          ragDesc.rerankModel = ""; // 重排序模型 PS: 未实现
          ragDesc.queryRewrite = 0; // 查询重写 1=开启 0=关闭 PS: 未实现
          ragDesc.vectorWeight = 0.7; // 向量权重
          ragDesc.keywordWeight = 0.3; // 关键词权重

          // 重新写入文件
          pub.write_file(ragDescFile, JSON.stringify(ragDesc, null, 4));
        }

        if (!ragDesc.supplierName) {
          ragDesc.supplierName = "ollama";
          pub.write_file(ragDescFile, JSON.stringify(ragDesc, null, 4));
        }

        ragList.push(ragDesc);
      }
    }

    return pub.return_success(pub.lang("获取成功"), ragList);
  }

  /**
   * 修改知识库信息
   * @param {string} ragName - 知识库名称
   * @param {string} ragDesc - 知识库描述
   * @returns {Promise<any>} - 修改结果
   */
  async modify_rag(args: { ragName: string; ragDesc: string }): Promise<any> {
    // logger.info("modify rag");

    // 检查参数
    if (!args.ragName) {
      return pub.return_error(pub.lang("知识库名称不能为空"));
    }
    if (args.ragName == "vector_db") {
      return pub.return_error(pub.lang("知识库名称不能为vector_db"));
    }

    // 知识库保存路径
    const ragPath = RAG_PATH + "/" + args.ragName;

    // 检查知识库是否存在
    if (!pub.file_exists(ragPath)) {
      return pub.return_error(pub.lang("知识库不存在"));
    }

    // 创建知识库描述文件
    const ragDescFile = ragPath + "/config.json";
    pub.write_file(ragDescFile, JSON.stringify(args, null, 4));

    return pub.return_success(pub.lang("知识库修改成功"));
  }

  /**
   * 上传知识库文档
   * @param {string} ragName - 知识库名称
   * @param {string} filePath - 文件路径 JSON列表
   * @returns {Promise<any>} - 上传结果
   */
  async upload_doc(args: { ragName: string; filePath: string }): Promise<any> {
    // logger.info("upload rag file");

    // 检查参数
    if (!args.ragName) {
      return pub.return_error(pub.lang("知识库名称不能为空"));
    }

    if (args.ragName == "vector_db") {
      return pub.return_error(pub.lang("知识库名称不能为vector_db"));
    }

    if (!args.filePath) {
      return pub.return_error(pub.lang("文件路径不能为空"));
    }
    let filePathList: string[] = JSON.parse(args.filePath);
    if (filePathList.length == 0) {
      return pub.return_error(pub.lang("文件路径列表不能为空"));
    }

    // 知识库保存路径
    const ragPath = RAG_PATH + "/" + args.ragName;

    // 检查知识库是否存在
    if (!pub.file_exists(ragPath)) {
      return pub.return_error(pub.lang("知识库不存在"));
    }

    let ragObj = new Rag();
    // 遍历文件列表
    for (const srcFile of filePathList) {
      // 检查文件是否存在
      if (!pub.file_exists(srcFile)) {
        return pub.return_error(pub.lang("文件不存在"));
      }

      const fileName = path.basename(srcFile);
      // 保存目录
      let dstFile = `${ragPath}/source/${fileName}`;

      // 如果同名文件已经存在，则在文件名后面加上编号
      let i = 1;
      while (pub.file_exists(dstFile)) {
        dstFile = `${ragPath}/source/${path.basename(srcFile, path.extname(srcFile))}_${i}${path.extname(srcFile)}`;
        i++;
      }

      // 复制文件到知识库目录，不复制文件属性
      fs.writeFileSync(dstFile, fs.readFileSync(srcFile));

      await ragObj.addDocumentToDB(dstFile, args.ragName);
    }

    return pub.return_success(pub.lang("文件上传成功"));
  }

  /**
   * 获取知识库文档列表
   * @param {string} ragName - 知识库名称
   * @returns {Promise<any>} - 文件列表
   */
  async get_rag_doc_list(args: { ragName: string }): Promise<any> {
    // logger.info("get rag file list");

    // 检查参数
    if (!args.ragName) {
      return pub.return_error(pub.lang("知识库名称不能为空"));
    }

    // 知识库保存路径
    const ragPath = RAG_PATH + "/" + args.ragName;

    // 检查知识库是否存在
    if (!pub.file_exists(ragPath)) {
      return pub.return_error(pub.lang("知识库不存在"));
    }

    let result = await LanceDBManager.queryRecord("doc_table", "doc_rag='" + args.ragName + "'");

    return pub.return_success(pub.lang("获取成功"), result);
  }

  /**
   * 获取知识库文档内容
   * @param {string} ragName - 知识库名称
   * @param {string} docName - 文档名称
   * return {Promise<any>} - 文档内容
   */
  async get_doc_content(args: { ragName: string; docName: string }): Promise<any> {
    let mdFile = pub.get_data_path() + "/rag/" + args.ragName + "/markdown/" + args.docName + ".md";
    if (pub.file_exists(mdFile)) {
      let content = pub.read_file(mdFile);
      content = content.replace("{URL}", "http://127.0.0.1:7071");
      return pub.return_success(pub.lang("获取成功"), content);
    }
    return pub.return_error(pub.lang("文档不存在"));
  }

  /**
   * 下载知识库文档
   * @param {string} ragName - 知识库名称
   * @param {string} docName - 文档名称
   * @returns {Promise<any>} - 文件下载流
   */
  async download_doc(args: { ragName: string; docName: string }, event: any): Promise<any> {
    // 检查参数
    if (!args.ragName) {
      return pub.return_error(pub.lang("知识库名称不能为空"));
    }
    if (!args.docName) {
      return pub.return_error(pub.lang("文档名称不能为空"));
    }

    // 知识库保存路径
    const ragPath = RAG_PATH + "/" + args.ragName;

    // 检查知识库是否存在
    if (!pub.file_exists(ragPath)) {
      return pub.return_error(pub.lang("知识库不存在"));
    }

    // 检查文档是否存在
    const docFile = ragPath + "/source/" + args.docName;
    if (!pub.file_exists(docFile)) {
      return pub.return_error(pub.lang("文档不存在"));
    }

    // 设置响应头
    event.response.set("Content-Type", "application/octet-stream");
    // 设置下载文件名
    let filename = encodeURIComponent(args.docName);
    event.response.set("Content-Disposition", `attachment; filename="${filename}"`);

    // 返回文件流
    const stream = fs.createReadStream(docFile);
    return stream;
  }

  async remove_doc(args: { ragName: string; docIdList: string }): Promise<any> {
    // 检查参数
    if (!args.ragName) {
      return pub.return_error(pub.lang("知识库名称不能为空"));
    }
    if (!args.docIdList) {
      return pub.return_error(pub.lang("文档名称不能为空"));
    }

    // 知识库保存路径
    const ragPath = RAG_PATH + "/" + args.ragName;

    // 检查知识库是否存在
    if (!pub.file_exists(ragPath)) {
      return pub.return_error(pub.lang("知识库不存在"));
    }

    let docList = JSON.parse(args.docIdList);
    if (docList.length == 0) {
      return pub.return_error(pub.lang("文档名称列表不能为空"));
    }

    let ragObj = new Rag();

    // 遍历文件列表
    for (const docId of docList) {
      // 获取docName
      let docName = await ragObj.getDocNameByDocId(docId);
      if (!docName) {
        return pub.return_error(pub.lang("文档不存在"));
      }

      // 检查文件是否存在
      const docFile = ragPath + "/source/" + docName;
      if (!pub.file_exists(docFile)) {
        return pub.return_error(pub.lang("文档不存在"));
      }

      // 删除文件
      fs.unlinkSync(docFile);

      // 删除markdown文件
      const mdFile = ragPath + "/markdown/" + docName + ".md";
      if (pub.file_exists(mdFile)) {
        fs.unlinkSync(mdFile);
      }

      // 删除数据库记录
      await ragObj.removeRagDocument(args.ragName, docId);
    }

    return pub.return_success(pub.lang("文档删除成功"));
  }

  // /**
  //  * 修改文档名称
  //  * @param {string} ragName - 知识库名称
  //  * @param {string} docName - 文档名称
  //  * @param {string} newDocName - 新文档名称
  //  */
  // async modify_rag_file_name(args: { ragName:string, docName:string, newDocName:string}): Promise<any> {
  //     logger.info("modify rag file name");

  //     // 检查参数
  //     if (!args.ragName) {
  //         return pub.return_error(pub.lang('知识库名称不能为空'));
  //     }
  //     if (!args.docName) {
  //         return pub.return_error(pub.lang('文档名称不能为空'));
  //     }
  //     if (!args.newDocName) {
  //         return pub.return_error(pub.lang('新文档名称不能为空'));
  //     }

  //     // 知识库保存路径
  //     const ragPath = RAG_PATH + "/" + args.ragName;

  //     // 检查知识库是否存在
  //     if (!pub.file_exists(ragPath)) {
  //         return pub.return_error(pub.lang('知识库不存在'));
  //     }

  //     // 检查文档是否存在
  //     const docFile = ragPath + "/source/" + args.docName;
  //     if (!pub.file_exists(docFile)) {
  //         return pub.return_error(pub.lang('文档不存在'));
  //     }

  //     // 修改文档名称
  //     const newDocFile = ragPath + "/source/" + args.newDocName;
  //     fs.renameSync(docFile, newDocFile);

  //     // 修改markdown文件名称
  //     const mdFile = ragPath + "/markdown/" + path.basename(args.docName) + ".md";
  //     const newMdFile = ragPath + "/markdown/" + path.basename(args.newDocName) + ".md";
  //     if (pub.file_exists(mdFile)) {
  //         fs.renameSync(mdFile, newMdFile);
  //     }

  //     return pub.return_success(pub.lang('文档名称修改成功'));
  // }

  /**
   * 重新生成文档索引
   * @param args
   * @param args.ragName <string> 知识库名称
   * @param args.docName <string> 文档名称
   * @returns
   */
  async reindex_document(args: { ragName: string; docId: string }): Promise<any> {
    let result = await new Rag().reindexDocument(args.ragName, args.docId);
    if (!result) {
      return pub.return_error(pub.lang("操作失败"));
    }
    return pub.return_success(pub.lang("操作成功"));
  }

  /**
   * 重新生成知识库索引
   * @param args
   * @param args.ragName <string> 知识库名称
   * @returns
   */
  async reindex_rag(args: { ragName: string }): Promise<any> {
    let result = await new Rag().reindexRag(args.ragName);
    if (!result) {
      return pub.return_error(pub.lang("操作失败"));
    }
    return pub.return_success(pub.lang("操作成功"));
  }

  /**
   * 检索知识库
   * @param args
   * @param args.ragName <string> 知识库名称
   * @param args.queryText <string> 查询文本
   * @returns
   */
  async search_document(args: { ragList: string; queryText: string }): Promise<any> {
    let result = await new Rag().searchDocument(JSON.parse(args.ragList), args.queryText);
    return pub.return_success(pub.lang("操作成功"), result);
  }

  /**
   * 获取图片
   * @param args
   * @param args.r <string> 知识库名称
   * @param args.n <string> 图片名称
   * @returns
   */
  async images(args: { r: string; n: string }, event: any): Promise<any> {
    // 检查参数
    if (!args.r) {
      return pub.return_error(pub.lang("知识库名称不能为空"));
    }
    if (!args.n) {
      return pub.return_error(pub.lang("图片名称不能为空"));
    }

    // 知识库保存路径
    const ragPath = RAG_PATH + "/" + args.r;

    // 检查知识库是否存在
    if (!pub.file_exists(ragPath)) {
      return pub.return_error(pub.lang("知识库不存在"));
    }

    // 检查图片是否存在
    let imgFile = ragPath + "/images/" + args.n;
    if (!pub.file_exists(imgFile)) {
      let imgFile1 = imgFile + ".png";
      if (!pub.file_exists(imgFile1)) {
        imgFile1 = imgFile + ".jpg";
        if (!pub.file_exists(imgFile1)) {
          return pub.return_error(pub.lang("图片不存在"));
        }
      }
    }

    // 设置响应头
    event.response.set("Content-Type", "image/png");

    // 返回文件流
    const stream = fs.createReadStream(imgFile);
    return stream;
  }
}

/**
 * 重写 RagController 类的 toString 方法，方便调试和日志输出
 * @returns {string} - 类的字符串表示
 */
RagController.toString = (): string => "[class RagController]";

export default RagController;
