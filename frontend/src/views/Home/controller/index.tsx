import { get, post } from "@/api";
import { storeToRefs } from "pinia";
import useIndexStore, { type ChatInfo, type ActiveKnowledgeDto, type ActiveKnowledgeDocDto, type KnowledgeDocumentInfo, type ThirdPartyApiServiceItem, type MultipeQuestionDto } from "../store";
import { message, useDialog, modal } from "@/utils/naive-tools";
import OtherModel from "../components/OtherModel.vue";
import SoftSettings from "../components/SoftSettings.vue";
import CreateKnowledgeStore from "../components/CreateKnowledgeStore.vue";
import UploadKnowledgeDoc from "../components/UploadKnowledgeDoc.vue";
import axios from "axios";
import { eventBUS } from "../utils/tools";
import { nextTick, ref } from "vue";
import { NButton, NSpin, NTooltip } from "naive-ui";
import i18n from "@/lang";
// 模拟请求
import { getRandomStringFromSet, testRequest } from "@/utils/tools";
const $t = i18n.global.t;

/**
 * @description 获取版本号
 */
export async function getVersion() {
  const { version } = getIndexStore();
  const {
    message: { version: version_val },
  } = await get("index/get_version");
  version.value = version_val;
}

/**
 * @description 获取store内容
 */
function getIndexStore() {
  const indexStore = useIndexStore();
  return storeToRefs(indexStore);
}

/**
 * @descript 获取已安装模型列表
 */
export async function get_model_list() {
  const { modelList, currentModel, currentSupplierName } = getIndexStore();
  const res = await post("/chat/get_model_list");
  modelList.value = Object.values(res.message).reduce((p: any, v: any) => {
    return [
      ...p,
      ...v.reduce((_p: any, _v: any) => {
        return [
          ..._p,
          {
            label: _v.title,
            value: _v.model,
            ..._v,
          },
        ];
      }, []),
    ];
  }, []);
  if (modelList.value.length && currentSupplierName.value == "") {
    currentSupplierName.value = modelList.value[0].supplierName;
  }
}

/**
 * @description 判断某个模型是否已安装
 */
export function isInstalled(model: string) {
  let flag = false;
  const { modelList } = getIndexStore();
  modelList.value.forEach((item: any) => {
    if (item.label == model) flag = true;
  });
  return flag;
}

/**
 * @description 获取对话列表
 */
export async function get_chat_list() {
  const { chatList, currentContextId, currentChatTitle, chatHistory, currentModel, currentSupplierName, contextIdForDel, netActive, activeKnowledgeForChat } = getIndexStore();
  const res = await post("/chat/get_chat_list");
  chatList.value = res.message;
  if (chatList.value.length) {
    if (currentContextId.value == contextIdForDel.value) {
      currentContextId.value = chatList.value[0].context_id;
      currentChatTitle.value = chatList.value[0].title;
      if (chatList.value[0].supplierName == "ollama") {
        currentModel.value = chatList.value[0].model + ":" + chatList.value[0].parameters;
      } else {
        currentModel.value = chatList.value[0].model;
      }
      currentSupplierName.value = chatList.value[0].supplierName!;
      chatList.value[0].search_type ? (netActive.value = true) : (netActive.value = false);
      activeKnowledgeForChat.value = chatList.value[0].rag_list ? chatList.value[0].rag_list : [];
      getChatInfo(currentContextId.value);
    }
  }
}

/**
 * @description 创建新对话：打开新对话窗口
 */
export function createNewComu() {
  const { currentContextId, currentChatTitle, chatHistory, activeKnowledgeForChat, netActive, activeKnowledge, activeKnowledgeDto } = getIndexStore();
  // if (currentContextId.value == "") return
  // chatList.value.push({
  //     contextPath: "",
  //     context_id: "",
  //     model: "",
  //     parameters: "",
  //     title: "新对话"
  // })
  currentContextId.value = "";
  currentChatTitle.value = $t("新对话");
  chatHistory.value = new Map();
  activeKnowledgeForChat.value = [];
  netActive.value = false;
  activeKnowledge.value = "";
  activeKnowledgeDto.value = null;
  knowledgeIsClose();
}

/**
 * @description 创建新对话：发起请求
 */
export async function create_chat(title: string) {
  const { currentModel, currentContextId, questionContent } = getIndexStore();
  const [model, parameters] = currentModel.value.split(":");
  const res = await post("/chat/create_chat", { model, parameters, title: questionContent.value });
  currentContextId.value = res.message.context_id;
  get_chat_list();
}

/**
 * @description 获取对话信息
 */
export async function getChatInfo(context_id: string) {
  const { chatHistory } = getIndexStore();
  const res = await post("/chat/get_chat_info", { context_id });
  if (res.code == 200) {
    chatHistory.value = generateObject(res.message);
  }
  // 渲染对话历史后立即滑动到底部
  nextTick(() => eventBUS.$emit("doScroll"));
}

// 拼接对话记录
function generateObject(arr: any) {
  const result: ChatInfo = new Map();
  for (let i = 0; i < arr.length; i += 2) {
    // const key = arr[i].content;
    const key = {
      content: arr[i].content,
      files: arr[i].doc_files ? arr[i].doc_files : [],
      images: arr[i].images ? arr[i].images : [],
    };
    let value = arr[i + 1] ? arr[i + 1].reasoning + arr[i + 1].content : $t("模型异常，请重新生成");
    result.set(key, {
      content: value,
      stat: arr[i + 1].stat,
      search_result: arr[i + 1].search_result,
      id: arr[i + 1].id,
    });
  }
  return result;
}

/**
 * @description 发送对话
 */
type ChatParams = {
  user_content: string;
  doc_files?: string;
  images?: string;
  regenerate_id?: string;
};
export async function sendChat(params: ChatParams) {
  const { currentModel, currentContextId, chatHistory, currentTalkingChatId, isInChat, targetNet, activeKnowledgeForChat, netActive, currentSupplierName, temp_chat } = getIndexStore();
  const [model, parameters] = currentModel.value.split(":");
  // 如果当前对话不存在则创建对话
  if (!currentContextId.value) {
    await create_chat(params.user_content);
  }
  currentTalkingChatId.value = currentContextId.value;
  // 找到当前对话的记录
  let currentChat: null | MultipeQuestionDto = null;
  for (let [key] of chatHistory.value) {
    if (key.content == params.user_content) {
      currentChat = key;
    }
  }

  await axios.post(
    "http://127.0.0.1:7071/chat/chat",
    {
      model,
      parameters,
      context_id: currentContextId.value,
      search: netActive.value ? targetNet.value : "",
      rag_list: JSON.stringify(activeKnowledgeForChat.value),
      supplierName: currentSupplierName.value,
      temp_chat: String(temp_chat.value),
      ...params,
    },
    {
      responseType: "text",
      onDownloadProgress: (progressEvent: any) => {
        // 获取当前接收到的部分响应数据
        const currentResponse = progressEvent.event.currentTarget.responseText;
        // 防止切换带来的错误
        if (currentTalkingChatId.value == currentContextId.value) chatHistory.value.set(currentChat!, { content: currentResponse, stat: { model: currentModel.value }, id: "" });
      },
    }
  );

  // 请求结束行为可以在此执行
  const lastChhat = await post("/chat/get_last_chat_history", { context_id: currentContextId.value });
  if (chatHistory.value.get(currentChat!)) {
    // chatHistory.value.get(params.user_content)!.stat = lastChhat.message.eval_count
    Object.assign(chatHistory.value.get(currentChat!)!.stat as Object, lastChhat.message.stat);
    chatHistory.value.get(currentChat!)!.search_result = lastChhat.message.search_result as Array<any>;
    chatHistory.value.get(currentChat!)!.id = lastChhat.message.id;
  }
  isInChat.value = false;
}

/**
 * @description 终止对话生成
 */
export async function stopGenerate() {
  const { currentContextId, isInChat } = getIndexStore();
  const res = await post("/chat/stop_generate", { context_id: currentContextId.value });
  if (res.code == 200) {
    message.success($t("对话已停止"));
  }
  isInChat.value = false;
  await post("/chat/get_last_chat_history", { context_id: currentContextId.value });
  await getChatInfo(currentContextId.value);
}

/**
 * @description 删除对话
 */
export async function removeChat(context_id: string) {
  const { chatRemoveConfirm } = getIndexStore();
  const res = await post("/chat/remove_chat", { context_id });
  if (res.code == 200) {
    message.success($t("对话删除成功"));
    get_chat_list();
    chatRemoveConfirm.value = false;
  } else {
    message.error(`${$t("对话删除失败：")}${res.error_msg}`);
  }
}

/**
 * @description 修改指定对话标题
 */
export async function modifyChatTitle(params: { context_id: string; title: string }) {
  const { chatModifyConfirm } = getIndexStore();
  const res = await post("/chat/modify_chat_title", params);
  if (res.code == 200) {
    message.success($t("对话标题修改成功"));
    get_chat_list();
    chatModifyConfirm.value = false;
  } else {
    message.error(`${$t("对话标题修改失败:")}${res.error_msg}`);
  }
}

/**
 * @description 打开模型管理
 */
export function openModelManage() {
  const { settingsShow, isInstalledManager, managerInstallConfirm } = getIndexStore();
  settingsShow.value = true;
  if (!isInstalledManager.value) {
    managerInstallConfirm.value = true;
  }
}

/**
 * @description 获取机器配置信息
 */
export async function getConfigurationInfo() {
  const { pcInfo } = getIndexStore();
  const res = await post("/manager/get_configuration_info");
  pcInfo.value = res.message;
}

/**
 * @description 获取可安装模型列表
 */
export async function getVisibleModelList() {
  const { visibleModelList, settingsShow, managerInstallConfirm, isInstalledManager, isResetModelList } = getIndexStore();
  const res = await post("/manager/get_model_manager");
  if (res.code == 200) {
    isInstalledManager.value = res.message.status;
    // 如果status为false说明本地没有模型管理器，要求对方安装
    if (res.message.status == false) {
      settingsShow.value = true;
      managerInstallConfirm.value = true;
    }
    // isInstalledManager.value = true
    visibleModelList.value = res.message.models;
    if (isResetModelList.value.type == 1) {
      isResetModelList.value.status = true;
    }
  }
}

/**
 * @description 获取本机盘符信息
 */
export async function getDiskList() {
  const res = await post("/manager/get_disk_list");
}

/**
 * @description 安裝大模型
 */
export async function installModel(modelName?: string, callback?: () => void) {
  const { modelNameForInstall, installShow } = getIndexStore();
  let res = null;
  if (modelName) {
    const modelSplit = modelName.split(":");
    modelNameForInstall.value = { model: modelSplit[0], parameters: modelSplit[1] };
  }
  // 执行安装
  res = post("/manager/install_model", modelNameForInstall.value);
  installShow.value = true;
  // 获取安装进度
  getModelInstallProgress(callback);
}

/**
 * @description 获取大模型安装进度
 */
export async function getModelInstallProgress(callback?: () => void) {
  const { modelInstallProgress, installShow, modelNameForInstall, downloadText, settingsShow } = getIndexStore();
  let timer = setInterval(async () => {
    const res = await post("/manager/get_model_install_progress", modelNameForInstall.value);
    if (res.message.status == 3) {
      message.success($t("安装成功"));
      installShow.value = false;
      downloadText.value = $t("正在连接，请稍候...");
      settingsShow.value = false;
      clearInterval(timer);
      get_model_list();
      getVisibleModelList();
      callback && callback();
    }
    const modelNameFull = modelNameForInstall.value.model + ":" + modelNameForInstall.value.parameters;
    if (res.message.status == 0) {
      // 等待下载
      downloadText.value = $t("等待下载:{0}，请稍候...", [modelNameFull]);
    }

    if (res.message.status == 1) {
      // 正在下载
      downloadText.value = $t("正在下载:{0}，请稍候...", [modelNameFull]);
    }

    if (res.message.status == 2) {
      // 正在安装
      downloadText.value = $t("正在安装:{0}，请稍候...", [modelNameFull]);
    }

    if (res.message.status == -1) {
      message.error($t("安装失败"));
      installShow.value = false;
      clearInterval(timer);
    }

    modelInstallProgress.value = res.message;
  }, 1000);
}

/**
 * @description 删除模型
 */
export async function removeModel() {
  const { modelForDel, modelDelLoading, modelDelConfirm } = getIndexStore();
  const [model, parameters] = modelForDel.value.split(":");
  const res = await post("/manager/remove_model", { model, parameters });
  if (res.code == 200) {
    message.success($t("模型删除成功"));
    get_model_list();
  } else {
    message.error($t("模型删除失败:{0}", [res.error_msg]));
  }
  modelDelLoading.value = false;
  modelDelConfirm.value = false;
}

/**
 * @description 安装模型管理器
 */
export async function installModelManager() {
  const { managerForInstall, modelManagerInstallProgresShow, managerInstallConfirm, modelManagerInstallNotice } = getIndexStore();
  modelManagerInstallProgresShow.value = true;
  managerInstallConfirm.value = false;
  post("/manager/install_model_manager", { manager_name: managerForInstall.value });
  modelManagerInstallNotice.value = $t("正在下载");
  getModelManagerInstallProgress();
}

/**
 * @description 获取模型管理器安装进度
 */
export async function getModelManagerInstallProgress() {
  const { managerForInstall, modelManagerInstallProgresShow, modelManagerInstallProgress, isInstalledManager, isResetModelList, modelManagerInstallNotice } = getIndexStore();
  let timer = setInterval(async () => {
    const res = await post("/manager/get_model_manager_install_progress", { manager_name: managerForInstall.value });
    if (res.message.status == 0) modelManagerInstallNotice.value = $t("正在选择下载节点，请稍后");
    if (res.message.status == 1) modelManagerInstallNotice.value = $t("正在下载模型管理器，请稍后");
    if (res.message.status == 2) modelManagerInstallNotice.value = $t("正在安装模型管理器，可能要几分钟时间，请耐心等待");
    if (res.message.status == 3) {
      modelManagerInstallNotice.value = $t("安装成功");
      message.success($t("模型管理器安装成功"));
      modelManagerInstallProgresShow.value = false;
      isInstalledManager.value = true;
      clearInterval(timer);
      getVisibleModelList();
      isResetModelList.value.type = 1;
    }

    if (res.message.status == -1) {
      message.error($t("模型管理器安装失败"));
      clearInterval(timer);
    }

    modelManagerInstallProgress.value = res.message;
  }, 1000);
}
/**
 * @description 重新选择下载节点
 */
export async function reconnect_model_download() {
  const res: any = await post("/manager/reconnect_model_download", {});
  message.success(res.msg);
}

/**
 * @description 获取当前语言和支持的语言列表
 */
export async function get_languages() {
  const { languageOptions, currentLanguage } = getIndexStore();
  const res = await post("/index/get_languages");
  languageOptions.value = res.message.languages.reduce((p: any, v: any) => {
    return [...p, { label: v.title, value: v.name }];
  }, []);
}

/**
 * @description 设置当前语言
 */
export async function setServiceLanguage(language: string) {
  await post("/index/set_language", { language });
}

/**
 * @description 获取分享列表
 */
export async function getShareList() {
  const { shareHistory } = getIndexStore();
  const res = await post("/share/get_share_list");
  shareHistory.value = res.message;
}

/**
 * @description 创建分享
 */
export async function createShare(title: string, modelDto: any, ragList: string[]) {
  let parameters = "otherApi";
  let model = "";
  // 判断当前为ollama还是三方模型，从而改变参数
  if (modelDto.supplierName == "ollama") {
    parameters = modelDto.model.split(":")[1];
    model = modelDto.model.split(":")[0];
  } else {
    model = modelDto.model;
  }
  await post("/share/create_share", {
    model,
    parameters,
    title,
    supplierName: modelDto.supplierName,
    rag_list: JSON.stringify(ragList),
  });
  getShareList();
  message.success($t("创建分享成功"));
}

/**
 * @description 修改分享
 */
export async function modifyShare(share_id: string, modelDto: any, title: string, ragList: string[]) {
  const { modifyShareShow } = getIndexStore();
  // const [model, parameters] = modelName.split(":")
  let parameters = "otherApi";
  let model = "";
  // 判断当前为ollama还是三方模型，从而改变参数
  if (modelDto.supplierName == "ollama") {
    parameters = modelDto.model.split(":")[1];
    model = modelDto.model.split(":")[0];
  } else {
    model = modelDto.model;
  }
  await post("/share/modify_share", {
    share_id,
    model,
    parameters,
    supplierName: modelDto.supplierName,
    rag_list: JSON.stringify(ragList),
    title,
  });
  await getShareList();
  message.success($t("修改成功"));
  modifyShareShow.value = false;
}

/**
 * @description 删除分享
 */
export async function delShare(share_id: string) {
  const { delShareConfirmShow } = getIndexStore();
  await post("/share/remove_share", { share_id });
  await getShareList();
  message.success("删除分享成功");
  delShareConfirmShow.value = false;
}

// 知识库展开状态
function knowledgeIsOpen() {
  const { knowledgeSiderWidth } = getIndexStore();
  knowledgeSiderWidth.value = 240;
}

// 知识库关闭状态
export function knowledgeIsClose() {
  const { knowledgeSiderWidth } = getIndexStore();
  knowledgeSiderWidth.value = 0;
}

/**
 * @description 打开知识库侧边栏界面
 */
export async function openKnowledgeStore(ragDto: ActiveKnowledgeDto) {
  const { knowledgeSiderWidth, activeKnowledge, activeKnowledgeDto, activeKnowledgeForChat } = getIndexStore();
  handleSwitchKnowledge(ragDto);
  activeKnowledgeDto.value = ragDto;
  activeKnowledge.value = ragDto.ragName;
  activeKnowledgeForChat.value = [ragDto.ragName];
  await getRagDocList(activeKnowledge.value as string);
  if (knowledgeSiderWidth.value == 0) {
    knowledgeIsOpen();
  }
  singleActive("knowledge", ragDto.ragName);
}

/**
 * @description 获取知识库状态
 */
export async function ragStatus() {
  const { isInstalledBge } = getIndexStore();
  const { code } = await post("/rag/rag_status");
  if (code !== 200) {
    isInstalledBge.value = false;
  } else {
    isInstalledBge.value = true;
  }
}

/**
 * @description 提示安装bge,安装完成后继续创建新的知识库
 */
export function installBge() {
  const { settingsShow, isInstalledBge, thirdPartyApiShow } = getIndexStore();
  /**
   * @description 安装本地模型
   */
  function doOllama() {
    settingsShow.value = true;
    dialog.destroy();
  }

  /**
   * @description 接入第三方
   */
  function doThird() {
    thirdPartyApiShow.value = true;
    dialog.destroy();
  }

  /**
   * @description 立即安装本地知识库嵌套模型
   */
  async function installBgeNow() {
    dialog.destroy();
    await installModel("bge-m3:latest", () => {
      isInstalledBge.value = true;
      createNewKnowledgeStore();
    });
  }
  const dialog = useDialog({
    title: $t("请安装或接入嵌入模型"),
    selfClosable: true,
    content: () => {
      return (
        <div class="flex flex-col items-start justify-center gap-2.5 mt-20">
          <div class="w-100%">
            <span>{$t("请选择从Ollama安装-Embedding-安装bge-m3:latest")}</span>
            <NButton type="primary" class="w-100%" onClick={installBgeNow}>
              {$t("使用本地模型嵌入（推荐）")}
            </NButton>
          </div>
          <div class="w-100%">
            <span>{$t("请选择接入第三方模型,接入支持Embedding三方API,如硅基流动")}</span>
            <NButton type="primary" ghost class="w-100%" onClick={doThird}>
              {$t("使用第三方API提供模型嵌入")}
            </NButton>
          </div>
        </div>
      );
    },
    action: () => {
      return <></>;
    },
    style: {
      width: "460px",
    },
  });
}

/**
 * @description 新建知识库：接口请求
 */
export async function createRag() {
  const { createKnowledgeFormData, activeKnowledge } = getIndexStore();
  const res = await post("/rag/create_rag", createKnowledgeFormData.value);
  if (res.code == 200) {
    activeKnowledge.value = createKnowledgeFormData.value.ragName;
    message.success($t("知识库创建成功"));
  } else {
    message.error($t("知识库创建失败"));
  }
}

/**
 * @description 获取知识库列表
 */
const initTime = ref(0);
export async function getRagList() {
  const { knowledgeList, activeKnowledge, activeKnowledgeDto } = getIndexStore();
  try {
    const res = await post("/rag/get_rag_list");
    knowledgeList.value = res.message;
    if (knowledgeList.value.length && activeKnowledge.value == null && initTime.value != 0) {
      activeKnowledge.value = knowledgeList.value[0].ragName;
      activeKnowledgeDto.value = knowledgeList.value[0];
    } else {
      initTime.value++;
    }
  } catch (error) {
    message.error($t("获取知识库列表失败，请重试"));
  }
}

/**
 * @description 知识库切换状态
 */
export function handleSwitchKnowledge(rag: KnowledgeDocumentInfo) {
  const { activeKnowledge, docContent } = getIndexStore();

  if (rag.ragName != activeKnowledge.value) {
    docContent.value = "";
  }
}

/**
 * @description 获取知识库文档列表
 */
export async function getRagDocList(ragName: string) {
  const { activeKnowledgeDocList } = getIndexStore();
  const res = await post("/rag/get_rag_doc_list", { ragName });
  activeKnowledgeDocList.value = res.message;
}

/**
 * @description 获取指定文档内容
 */
export async function getDocContent(doc: ActiveKnowledgeDocDto) {
  const { docContent } = getIndexStore();
  const res = await get("/rag/get_doc_content", { ragName: doc.doc_rag, docName: doc.doc_name });
  docContent.value = res.message;
}

/**
 * @description 文档列表轮询
 */
function ragDocLoop() {
  const { activeKnowledge, activeKnowledgeDocList, docParseStatus } = getIndexStore();
  let timer: any = null;
  docParseStatus.value = true;
  timer = setInterval(async () => {
    await getRagDocList(activeKnowledge.value as string);
    const parsedStstus = activeKnowledgeDocList.value.every((item) => {
      return item.is_parsed == 1;
    });
    if (parsedStstus) {
      clearInterval(timer);
      docParseStatus.value = false;
    }
  }, 5000);
}

/**
 * @description 删除知识库询问
 */
export function removeRagConfirm(ragName: string) {
  const dialog = useDialog({
    title: "提示",
    content: () => {
      return (
        <div class="flex items-center justify-center">
          <div class="box-border p-5 flex justify-center items-center gap-1.25 mt-20">
            <i class="i-jam:alert-f w-24 h-24 text-[#E6A23C]"></i>
            <span>{$t("是否确认删除知识库{0}及其下的所有文档？该操作不可逆", [ragName])}</span>
          </div>
        </div>
      );
    },
    style: {
      width: "500px",
    },
    onOk: async () => {
      await removeRag(ragName);
      dialog.destroy();
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
}

/***
 * @description 删除知识库
 */
export async function removeRag(ragName: string) {
  const { knowledgeList, activeKnowledge, activeKnowledgeDto } = getIndexStore();
  try {
    await post("/rag/remove_rag", { ragName });
    await getRagList();
    if (knowledgeList.value.length) {
      activeKnowledge.value = knowledgeList.value[0].ragName;
      activeKnowledgeDto.value = knowledgeList.value[0];
      await getRagDocList(activeKnowledge.value as string);
    }
    message.success($t("删除知识库成功"));
  } catch (error) {
    message.error($t("删除知识库失败，请重试"));
  }
}

/**
 * @description 修改知识库
 */
export async function modifyRag() {
  const { createKnowledgeFormData } = getIndexStore();
  await getEmbeddingModels();
  const dialog = useDialog({
    title: "修改知识库",
    content: () => <CreateKnowledgeStore disabledKey="ragName" />,
    style: {
      width: "480px",
    },
    onOk: async () => {
      try {
        await post("/rag/modify_rag", createKnowledgeFormData.value);
        await getRagList();
        message.success($t("修改知识库成功"));
        dialog.destroy();
      } catch (error) {
        message.error($t("修改知识库失败，请重试"));
      }
    },
    onCancel: () => {
      dialog.destroy();
    },
  });
}

/**
 * @description 获取嵌入模型列表
 */
export async function getEmbeddingModels() {
  const { embeddingModelsList } = getIndexStore();
  const res = await post("/rag/get_embedding_models");
  embeddingModelsList.value = Object.values(res.message).flat();
}

/**
 * @description 新建知识库：点击按钮后续交互逻辑
 */
export async function createNewKnowledgeStore() {
  const { createKnowledgeModelRef, createKnowledgeFormData, createKnowledgeDialogIns, activeKnowledge, isInstalledBge } = getIndexStore();
  await ragStatus();
  await getEmbeddingModels();
  if (!isInstalledBge.value) {
    installBge();
    return;
  }
  // 重置表单
  function resetForm() {
    createKnowledgeModelRef.value.restoreValidation();
    createKnowledgeFormData.value = { ragName: "", ragDesc: "", enbeddingModel: [], supplierName: "" };
    createKnowledgeDialogIns.value!.destroy();
  }
  createKnowledgeDialogIns.value = useDialog({
    title: "新建知识库",
    content: () => <CreateKnowledgeStore />,
    style: {
      width: "480px",
    },
    loading: true,
    onCancel() {
      resetForm();
    },
    onOk: async () => {
      const validRes = await createKnowledgeModelRef.value.validate();
      if (!validRes) return;
      // 创建知识库
      try {
        await createRag();
        resetForm();
        knowledgeIsOpen();
        await getRagList();
        await getRagDocList(activeKnowledge.value as string);
      } catch (error) {
        console.warn(error);
      }

      /*  knowledgeList.value.push({
                 ragName: 2,
                 ragName: "这是一份新的知识库",
                 test_createtime: "2025-03-06",
                 test_desc: "这是一份新的知识库，主要用于测试工作，在正式开发接口出具以后，我将替换这些测试数据",
                 test_size: "200KB",
                 test_docs: [
                     {
                         doc_name: "我的第一个知识库.docx",
                         doc_abstract: "这是我的第一份知识库文档，我将使用这份文档来进行一系列的开发和提效工作，但在正式开发接口发布后，这份虚拟数据将被我删除，请不要使用这份数据",
                         update_time: "2023-03-06"
                     }
                 ]
             })
             
             activeKnowledge.value = {
                 ragName: 2,
                 ragName: "这是一份新的知识库",
                 test_createtime: "2025-03-06",
                 test_desc: "这是一份新的知识库，主要用于测试工作，在正式开发接口出具以后，我将替换这些测试数据",
                 test_size: "200KB",
                 test_docs: [
                     {
                         doc_name: "我的第一个知识库.docx",
                         doc_abstract: "这是我的第一份知识库文档，我将使用这份文档来进行一系列的开发和提效工作，但在正式开发接口发布后，这份虚拟数据将被我删除，请不要使用这份数据",
                         update_time: "2023-03-06"
                     }
                 ]
             } */
    },
  });
}

/**
 * @description 上传知识库文档:打开弹窗
 */
export async function openDocUploadDialog() {
  const { fileOrDirList, chooseList, isUploadingDoc } = getIndexStore();
  async function doOk() {
    try {
      isUploadingDoc.value = true;
      await uploadRagDocForManual();
      isUploadingDoc.value = false;
      fileOrDirList.value = [];
      chooseList.value = [];
      dialog.destroy();
      ragDocLoop();
    } catch (error) {
      console.warn(error);
      isUploadingDoc.value = false;
    }
  }
  async function doCancel() {
    fileOrDirList.value = [];
    chooseList.value = [];
    isUploadingDoc.value = false;
    dialog.destroy();
  }
  const dialog = useDialog({
    title: "上传知识库文档",
    content: () => (
      <NSpin show={isUploadingDoc.value}>
        {{
          default: () => <UploadKnowledgeDoc />,
          description: () => <span>{$t("正在解析文档，这可能要几分钟时间...")}</span>,
        }}
      </NSpin>
    ),
    style: {
      width: "580px",
    },
    action: () => {
      return (
        <div class="flex justify-end items-center gap-5">
          <NButton onClick={doCancel} disabled={isUploadingDoc.value ? true : false}>
            {$t("取消")}
          </NButton>
          <NButton type="primary" onClick={doOk} disabled={isUploadingDoc.value || fileOrDirList.value.length == 0 ? true : false}>
            {$t("确认")}
          </NButton>
        </div>
      );
    },
  });
}

/**
 * @description 上传知识库文档：手动上传
 */
export async function uploadRagDocForManual() {
  const { fileOrDirList, activeKnowledge } = getIndexStore();
  const { code, msg } = await post("/rag/upload_doc", {
    ragName: activeKnowledge.value,
    filePath: JSON.stringify(fileOrDirList.value),
  });
  if (code == 200) {
    message.success(msg as string);
    // TODO:此处暂时需要做500ms的定时器，等待后端解析文件
    setTimeout(async () => {
      await getRagDocList(activeKnowledge.value as string);
    }, 500);
    return true;
  } else {
    message.error(msg as string);
    throw new Error(msg);
  }
}

/**
 * @description 删除知识库文档：弹窗
 */
export function delKnowledgeDoc(doc: any) {
  const { activeKnowledge } = getIndexStore();
  const dialog = useDialog({
    title: "提示",
    content: () => {
      return (
        <div class="flex items-center justify-center">
          <div class="box-border p-5 flex justify-center items-center gap-1.25 mt-20">
            <i class="i-jam:alert-f w-24 h-24 text-[#E6A23C]"></i>
            <span>{$t("是否确认删除文档{0}？该操作不可逆", [doc.doc_name])}</span>
          </div>
        </div>
      );
    },
    style: {
      width: "480px",
    },

    onOk: async () => {
      await removeDoc(doc);
      message.success($t("文档删除成功"));
      await getRagDocList(activeKnowledge.value as string);
      dialog.destroy();
    },
    onCancel() {
      dialog.destroy();
    },
  });
}

/**
 * @description 删除知识库文档：接口请求
 */
export async function removeDoc(doc: any) {
  const { activeKnowledge } = getIndexStore();
  await get("/rag/remove_doc", { ragName: activeKnowledge.value, docIdList: JSON.stringify([doc.doc_id]) });
}

/**
 * @description 打开软件设置弹窗
 */
export function openSoftSettings() {
  const dialog = useDialog({
    title: "设置",
    content: () => <SoftSettings />,
    style: {
      width: "480px",
    },
    loading: true,
    action: () => {
        return <div>
            <NButton onClick={() => dialog.destroy()}>{$t("关闭")}</NButton>
        </div>
    }
  });
  return dialog;
}

/**
 * @description 打开第三方模型api弹窗
 */
export function openThirdPartyModelApi() {
  // icon:()=><i class="i-tdesign:close-circle w-24 h-24 cursor-pointer text-[#909399]"></i>,

  const dialog = useDialog({
    title: "第三方模型API",
    content: () => <OtherModel />,
  });
}

/**
 * @description currentChat和currentKnowledge只能存在一个
 */
export function singleActive(type: "chat" | "knowledge", sign: any) {
  const { currentContextId, activeKnowledge } = getIndexStore();

  if (type == "chat") {
    activeKnowledge.value = "";
    currentContextId.value = sign;
    knowledgeIsClose();
  } else {
    currentContextId.value = "";
    activeKnowledge.value = sign;
  }
}

/**
 * @description 获取第三方供应商列表
 */
export async function getSupplierList() {
  const { thirdPartyApiServiceList, currentChooseApi, applierServiceConfig } = getIndexStore();
  const res = await post("/model/get_supplier_list");
  thirdPartyApiServiceList.value = res.message;
  currentChooseApi.value = res.message[0];
  getSupplierConfig(res.message[0]);
}

/**
 * @description 获取指定服务商下的模型列表
 */
export async function getSupplierModelList(supplierName: string) {
  const { supplierModelList, isAllModelEnable } = getIndexStore();
  const res = await post("/model/get_models_list", { supplierName });
  supplierModelList.value = res.message.filter((item: any) => item.title !== "");
  isAllModelEnable.value = supplierModelList.value.every((item) => item.status == true);
}

/**
 * @description 添加模型
 */
export async function addModels() {
  const { addModelFormData, currentChooseApi } = getIndexStore();
  const res = await post("/model/add_models", {
    supplierName: currentChooseApi.value?.supplierName,
    ...addModelFormData.value,
    capability: JSON.stringify(addModelFormData.value.capability),
  });
  await getEmbeddingModels();
  await get_model_list();
}

/**
 * @description 删除模型
 */
export async function removeSupplierModel(modelName: string) {
  const { currentChooseApi } = getIndexStore();
  await post("/model/remove_models", {
    supplierName: currentChooseApi.value?.supplierName,
    modelName,
  });
}

/**
 * @description 保存服务商配置
 */
export async function setSupplierConfig() {
  const { applierServiceConfig, currentChooseApi } = getIndexStore();
  await post("/model/set_supplier_config", { ...applierServiceConfig.value, supplierName: currentChooseApi.value?.supplierName });
  await get_model_list();
}

/**
 * @description 检查配置是否正确
 */
export async function checkSupplierConfig() {
  const { applierServiceConfig, currentChooseApi } = getIndexStore();
  const res = await post("/model/check_supplier_config", { ...applierServiceConfig.value, supplierName: currentChooseApi.value?.supplierName });
  return res.msg;
}

/**
 * @description 获取模型供应商api配置
 */
export async function getSupplierConfig(config: ThirdPartyApiServiceItem) {
  const { currentChooseApi, applierServiceConfig } = getIndexStore();
  const res = await post("/model/get_supplier_config", {
    supplierName: currentChooseApi.value?.supplierName,
  });
  applierServiceConfig.value.apiKey = res.message.apiKey;
  if (config.baseUrl) {
    applierServiceConfig.value.baseUrl = config.baseUrl;
  } else {
    applierServiceConfig.value.baseUrl = res.message.baseUrlExample;
  }
  getSupplierModelList(currentChooseApi.value?.supplierName!);
}

/**
 * @description 设置单个模型状态
 */
export async function setModelStatus(modelName: string, status: string) {
  const { currentChooseApi } = getIndexStore();
  await post("/model/set_model_status", {
    supplierName: currentChooseApi.value?.supplierName,
    modelName,
    status,
  });
  await getEmbeddingModels();
  await get_model_list();
}

/**
 * @description 添加模型服务商
 */
export async function addSupplier() {
  const { addSupplierFormData } = getIndexStore();
  const supplierName = getRandomStringFromSet(10);
  await post("/model/add_supplier", { ...addSupplierFormData.value, supplierName });
}

/**
 * @description 删除模型供应商
 */
export async function removeSupplier(supplierName: string) {
  await post("/model/remove_supplier", { supplierName });
  await getSupplierList();
  await getEmbeddingModels();
  await get_model_list();
}

/**
 * @description 设置供应商状态
 */
export async function setSupplierStatus(supplierName: string, status: boolean) {
  await post("/model/set_supplier_status", { supplierName, status: String(status) });
  if (status) {
    message.success($t("已启用模型该服务商"));
  } else {
    message.success($t("已禁用模型该服务商"));
  }
  await getEmbeddingModels();
  await get_model_list();
}

/**
 * @description 修改模型别名
 */
export async function setModelTitle(newTit: string) {
  const { currentChooseApi, currentModelNameForEdiit } = getIndexStore();
  await post("/model/set_model_title", {
    supplierName: currentChooseApi.value?.supplierName,
    title: newTit,
    modelName: currentModelNameForEdiit.value,
  });
  await getSupplierModelList(currentChooseApi.value?.supplierName!);
  await getEmbeddingModels();
  await get_model_list();
}
