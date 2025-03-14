import ollama from 'ollama';
import Stream from 'stream';
import { ChatService, ChatContext, ChatHistory } from '../service/chat';
import { pub } from '../class/public';
import { logger } from 'ee-core/log';
import { getPromptForWeb } from '../search_engines/search';
import { Rag } from '../rag/rag';
import { ModelService, GetSupplierModels, getModelContextLength } from '../service/model';
import path from 'path';

// 模型列表获取重试次数
let MODEL_LIST_RETRY = 0;

/**
 * 定义模型信息的类型
 * @typedef {Object} ModelInfo
 * @property {string} model - 模型名称
 * @property {number} size - 模型大小
 * @property {number} contextLength - 模型的上下文长度
 */
export type ModelInfo = {
    title: string,
    supplierName: string,
    model: string;
    size: number;
    contextLength: number;
};

/**
 * 存储所有模型信息的数组
 * @type {ModelInfo[]}
 */
export let ModelListInfo: ModelInfo[] = [];

/**
 * 存储对话上下文状态的映射，键为对话ID，值为是否继续生成的布尔值
 * @type {Map<string, boolean>}
 */
export let ContextStatusMap = new Map<string, boolean>();

/**
 * chat controller 类，处理与聊天相关的各种操作
 * @class
 */
class ChatController {
    /**
     * 获取对话列表
     * @returns {Promise<any>} - 包含对话列表的成功响应
     */
    async get_chat_list(): Promise<any> {
        // 创建 ChatService 实例
        const chatService = new ChatService();
        // 获取对话列表
        const chatList = chatService.get_chat_list();
        // 返回成功响应
        return pub.return_success(pub.lang("对话列表获取成功"), chatList);
    }

    /**
     * 创建新的对话
     * @param {Object} args - 创建对话所需的参数
     * @param {string} args.model - 模型名称
     * @param {string} args.parameters - 模型参数
     * @param {string} args.title - 对话标题
     * @param {string} args.supplierName - 供应商名称
     * @returns {Promise<any>} - 包含新对话信息的成功响应
     */
    async create_chat(args: { model: string; parameters: string; title: string, supplierName?: string }): Promise<any> {
        const { model, parameters, title, supplierName } = args;
        // 创建新对话并获取相关数据
        const data = new ChatService().create_chat(model, parameters, title, supplierName as string);
        // 返回成功响应
        return pub.return_success(pub.lang("对话创建成功"), data);
    }

    /**
     * 获取模型列表
     * @returns {Promise<any>} - 包含模型列表信息的成功响应
     */
    async get_model_list(): Promise<any> {
        // 清空模型信息列表
        ModelListInfo = [];
        try {
            // 获取所有模型信息
            MODEL_LIST_RETRY++;
            const res = await ollama.list();
            // 遍历模型信息，将其添加到 ModelListInfo 中
            res.models.forEach((modelInfo) => {
                if (modelInfo.name.indexOf('embed') == -1
                    && modelInfo.name.indexOf('bge-m3') == -1
                    && modelInfo.name.indexOf('all-minilm') == -1
                    && modelInfo.name.indexOf('multilingual') == -1
                    && modelInfo.name.indexOf('r1-1776') == -1) {
                    ModelListInfo.push({
                        title: "Ollama/" + modelInfo.name,
                        supplierName: 'ollama',
                        model: modelInfo.name,
                        size: modelInfo.size,
                        contextLength: 0
                    });
                }
            });

            // 遍历 ModelListInfo，获取每个模型的详细信息
            for (const info of ModelListInfo) {
                const modelRes = await ollama.show({ model: info.model });
                // 查找上下文长度信息并更新到 ModelListInfo 中
                for (const key in modelRes.model_info) {
                    if (key.indexOf('context_length') !== -1) {
                        info.contextLength = modelRes.model_info[key];
                    }
                }
            }
        } catch (error) {
            // 重试3次
            if (MODEL_LIST_RETRY < 4) {
                await pub.sleep(1000);
                return this.get_model_list();
            }
            // 记录错误信息
            logger.error(pub.lang('获取模型列表时出错:'), error);
        }

        let result = await GetSupplierModels();
        result['ollama'] = ModelListInfo;

        // 返回成功响应
        return pub.return_success(pub.lang("大模型列表获取成功"), result);
    }

    /**
     * 获取指定模型的信息
     * @param {string} model - 模型名称
     * @returns {ModelInfo} - 模型信息对象
     */
    get_model_info(model: string): ModelInfo {
        // 查找匹配的模型信息
        const foundInfo = ModelListInfo.find((info) => info.model === model);
        // 如果找到则返回，否则返回默认信息
        return foundInfo || {
            title: model,
            supplierName: 'ollama',
            model,
            size: 0,
            contextLength: getModelContextLength(model),
        };
    }

    /**
     * 保存对话内容
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} resUUID - 对话的唯一标识符
     * @param {ChatHistory} chatHistoryRes - 对话历史记录
     */
    async set_chat_history(uuid: string, resUUID: string, chatHistoryRes: ChatHistory) {
        // 处理推理内容
        const key = "\n</think>\n";
        if (chatHistoryRes.content.indexOf(key) !== -1) {
            const spArr = chatHistoryRes.content.split(key);
            chatHistoryRes.reasoning = spArr[0] + key;
            chatHistoryRes.content = spArr[1];
        }
        // 保存助手的聊天记录
        const chatService = new ChatService();
        chatService.set_chat_history(uuid, resUUID, chatHistoryRes);
    }

    /**
     * 判断是否为视觉模型
     * @param {string} supplierName - 供应商名称
     * @param {string} model - 模型名称
     * @returns {Promise<boolean>} - 是否为视觉模型
     */
    async isVisionModel(supplierName:string, model: string): Promise<boolean> {
        // 如果模型名称包含'vision'，直接返回true
        let modelLower = model.toLocaleLowerCase();
        if (modelLower.indexOf('vision') !== -1) {
            return true;
        }

        // 如果是线上模型，简单检查下常用非视觉模型
        if(supplierName != 'ollama') {
            if(modelLower.indexOf('-vl') !== -1) return true;
            let notVlist = ['qwen','deepseek','qwq','code','phi','gemma',];
            for (let i = 0; i < notVlist.length; i++) {
                if (modelLower.indexOf(notVlist[i]) !== -1) {
                    return false;
                }
            }
            return true;
        }

        try {
            // 读取模型列表
            const modelListFile = path.resolve(pub.get_resource_path(), 'ollama_model.json');
            
            // 检查文件是否存在
            if (!pub.file_exists(modelListFile)) {
                logger.warn('模型列表文件不存在:', modelListFile);
                return false;
            }
            
            const modelList = pub.read_json(modelListFile);
            
            // 检查模型列表是否为数组
            if (!Array.isArray(modelList)) {
                logger.warn('模型列表格式不正确');
                return false;
            }

            // 检查模型是否支持视觉能力
            for (const modelInfo of modelList) {
                // 检查模型名称匹配
                if (modelInfo.name === model || modelInfo.full_name === model) {
                    // 检查模型是否有capability属性且包含vision
                    if (modelInfo.capability && Array.isArray(modelInfo.capability) && 
                        modelInfo.capability.includes('vision')) {
                        return true;
                    }
                }
            }
        } catch (error) {
            logger.error('检查模型视觉能力时出错:', error);
        }

        return false;
    }



    /**
     * 开始对话
     * @param {Object} args - 对话所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @param {string} args.supplierName - 供应商名称
     * @param {string} args.model - 模型名称
     * @param {string} args.parameters - 模型参数
     * @param {string} args.user_content - 用户输入的内容
     * @param {string} args.search - 搜索类型
     * @param {string} args.rag_list - RAG列表
     * @param {string} args.regenerate_id - 重新生成的ID
     * @param {string} args.images - 图片列表
     * @param {string} args.doc_files - 文件列表
     * @param {any} event - 事件对象，用于处理HTTP响应
     * @returns {Promise<any>} - 可读流，用于流式响应对话结果
     */
    async chat(args: { context_id: string; supplierName?: string; model: string; parameters?: string; user_content: string, search?: string, rag_list?: string, regenerate_id?: string, images?: string, doc_files?: string, temp_chat?: string }, event: any): Promise<any> {
        let { context_id: uuid, model: modelName, parameters, user_content, search, regenerate_id, supplierName, images, doc_files, temp_chat } = args;
        if (!supplierName) {
            supplierName = 'ollama'
        }

        const isTempChat = temp_chat === 'true';

        const isOllama = supplierName === 'ollama';

        let modelStr = modelName;
        if (isOllama) {
            modelStr = `${modelName}:${parameters}`;
        } else {
            parameters = supplierName;
        }

        let images_list: string[] = [];
        if (images) {
            images_list = images.split(',');
        }

        let doc_files_list: string[] = [];
        if (doc_files) {
            doc_files_list = doc_files.split(',');
        }

        const chatService = new ChatService();
        // 构建用户的聊天上下文
        const chatContext: ChatContext = {
            role: 'user',
            content: user_content,
            images: images_list,
            doc_files: doc_files_list,
            tool_calls: ''
        };

        // 设置对话状态为正在生成
        ContextStatusMap.set(uuid, true);

        // 获取模型信息
        let modelInfo: ModelInfo = {
            title: modelName,
            supplierName: supplierName,
            model: modelName,
            size: 0,
            contextLength: getModelContextLength(modelName),
        }
        if (isOllama) {
            modelInfo = this.get_model_info(modelStr);
            if (modelInfo.contextLength === 0) {
                // 若上下文长度为0，重新获取模型列表并再次获取模型信息
                await this.get_model_list();
                modelInfo = this.get_model_info(modelStr);
            }

            if (modelInfo.contextLength === 0) {
                modelInfo.contextLength = getModelContextLength(modelName);
            }

        }

        // 保存新的模型信息
        chatService.update_chat_model(uuid, modelName, parameters as string, supplierName as string);

        // 获取对话历史
        let isVision = await this.isVisionModel(supplierName,modelName);
        let history = await chatService.build_chat_history(uuid, chatContext, modelInfo.contextLength, isTempChat,isVision);

        // 保存用户的聊天记录
        const chatHistory: ChatHistory = {
            id: "",
            role: "user",
            reasoning: "",
            stat: {},
            content: user_content,
            images: images_list,
            doc_files: doc_files_list,
            tool_calls: "",
            created_at: "",
            create_time: pub.time(),
            tokens: 0,
            search_result: [],
            search_type: search,
            search_query: "",
        };


        // 初始化助手的聊天记录
        let resUUID = pub.uuid();
        const chatHistoryRes: ChatHistory = {
            id: resUUID,
            role: "assistant",
            reasoning: "",
            stat: {
                model: modelStr,
                created_at: '',
                total_duration: 0,
                load_duration: 0,
                prompt_eval_count: 0,
                prompt_eval_duration: 0,
                eval_count: 0,
                eval_duration: 0,
            },
            content: "",
            images: [],
            doc_files: [],
            tool_calls: "",
            created_at: "",
            create_time: pub.time(),
            tokens: 0,
            search_result: [],
            search_type: search,
            search_query: "",
        };

        chatService.save_chat_history(uuid, chatHistory, chatHistoryRes, modelInfo.contextLength, regenerate_id);
        // 保存搜索类型到会话配置
        chatService.update_chat_config(uuid, "search_type", search);
        let isSystemPrompt = false;

        // 先使用知识库检索
        if (args.rag_list) {
            let ragList = JSON.parse(args.rag_list as string);
            // 保存RAG列表到会话配置
            chatService.update_chat_config(uuid, "rag_list", ragList);

            if (ragList.length > 0) {
                let { userPrompt, systemPrompt, searchResultList, query } = await new Rag().searchAndSuggest(ragList, modelStr, user_content, history[history.length - 1].doc_files);
                chatHistoryRes.search_query = query;
                chatHistoryRes.search_type = "[RAG]:" + ragList.join(",");
                chatHistoryRes.search_result = searchResultList;

                if (searchResultList.length > 0 && systemPrompt) {
                    // 将系统提示词插入到对话历史的第一条
                    history.unshift({
                        role: 'system',
                        content: systemPrompt
                    });
                    isSystemPrompt = true;
                }

                if (userPrompt) {
                    // 将用户提示词替换历史的最后一条
                    history[history.length - 1].content = userPrompt;
                }

                // 知识库有召回结果的情况下，不再进行联网搜索
                if (searchResultList.length > 0) {
                    search = ''
                }

            }
        }


        if (search) {
            // 获取上一次的对话历史
            let lastHistory = "";
            if (history.length > 2) {
                lastHistory += pub.lang("问题: ") + history[history.length - 3].content + "\n";
                lastHistory += pub.lang("回答: ") + history[history.length - 2].content + "\n";
            }

            let { userPrompt, systemPrompt, searchResultList, query } = await getPromptForWeb(user_content, modelStr, lastHistory, search, history[history.length - 1].doc_files);
            chatHistoryRes.search_query = query;
            chatHistoryRes.search_type = search;
            chatHistoryRes.search_result = searchResultList;

            if (systemPrompt && searchResultList.length > 0) {
                // 将系统提示词插入到对话历史的第一条
                history.unshift({
                    role: 'system',
                    content: systemPrompt
                });
                isSystemPrompt = true;
            }

            if (userPrompt) {
                // 将用户提示词替换历史的最后一条
                history[history.length - 1].content = userPrompt;
            }
        }

        let letHistory = history[history.length - 1];

        // 嵌入system提示
        //         if(!isSystemPrompt && letHistory.content === user_content) {
        //             let systemPrompt = `# 以下是日期和地区信息，你可以根据需要选择其中的内容。
        // ## ${pub.lang('当前日期和时间为')}: ${pub.getCurrentDateTime()}
        // ## ${pub.lang('用户所在地区为')}: ${pub.getUserLocation()}`
        //             history.unshift({
        //                 role: 'system',
        //                 content: systemPrompt
        //             });
        //         }

        // console.log("letHistory:",letHistory);

        // 嵌入文档
        if (letHistory.content === user_content && letHistory.doc_files.length > 0) {
            // console.log("doc:",letHistory.doc_files.length);
            // 将文档内容合并到用户输入
            if (modelName.toLocaleLowerCase().indexOf('qwen') == -1) {
                letHistory.content = `## ${pub.lang('以下是用户上传的文档内容，每个文档内容都是[用户文档 X begin]...[用户文档 X end]格式的，你可以根据需要选择其中的内容。')}
<doc_files>
{doc_files}
</doc_files>
## ${pub.lang('用户输入的内容')}:
{user_content}`;

                const doc_files_str = letHistory.doc_files.map(
                    (doc_file, idx) => {
                        if (!doc_file) return '';
                        return `[${pub.lang('用户文档')} ${idx + 1} begin]
                ${pub.lang('内容')}: ${doc_file}
                [${pub.lang('用户文档')} ${idx} end]`
                    }
                ).join("\n");


                letHistory.content = letHistory.content.replace("{doc_files}", doc_files_str);
                letHistory.content = letHistory.content.replace("{user_content}", user_content);
            } else {

                let doc_files_str = letHistory.doc_files.map(
                    (doc_file, idx) => {
                        if (!doc_file) return '';
                        return `${pub.lang('用户文档')} ${idx + 1} begin
${doc_file}
${pub.lang('用户文档')} ${idx + 1} end
`
                    }).join("\n");


                letHistory.content += "\n\n" + doc_files_str
            }
        }

        // 非视觉模型，将图片OCR内容合并到用户输入
        if(!isVision && letHistory.images.length > 0) {
            let ocrContent = letHistory.images.map((image, idx) => {
                return `${pub.lang('图片')} ${idx + 1} ${pub.lang('OCR解析结果')} begin
${image}
${pub.lang('图片')} ${idx + 1} ${pub.lang('OCR解析结果')} end
`}).join("\n");

            letHistory.content += "\n\n" + ocrContent;
        }

        if (letHistory.tool_calls !== undefined) {
            // 删除工具调用
            delete letHistory.tool_calls;
        }

        if (letHistory.doc_files !== undefined) {
            // 删除文档
            delete letHistory.doc_files;
        }

        if (!isOllama) {
            // 非Ollama模型，图片处理
            if (letHistory.images && letHistory.images.length > 0) {
                let content: any[] = [];
                content.push({ type: "text", text: letHistory.content });
                for (let image of letHistory.images) {
                    content.push({ type: "image_url", image_url: { url: image } });
                }

                letHistory.content = content;
            }
            if (letHistory.images) delete letHistory.images;

            history[history.length - 1] = letHistory;

            
        } else {
            // Ollama模型，删除data:image/jpeg;base64,
            if (letHistory.images && letHistory.images.length > 0) {
                let images: string[] = [];
                for (let image of letHistory.images) {
                    images.push(image.split(',')[1])
                }
                letHistory.images = images;
            }
        }


        // 发送消息到大模型
        const requestOption: any = {
            model: modelStr,
            messages: history,
            stream: true,
        }

        if (isOllama) {
            // 计算上下文长度
            let contextLength = 0;
            for (const message of history) {
                contextLength += message.content.length;
            }
            let max_ctx = 4096;
            let min_ctx = 2048;
            let parametersNumber = Number(parameters?.replace('b', '')) || 4;
            if (parametersNumber && parametersNumber <= 4) max_ctx = 8192;
            let num_ctx = Math.max(min_ctx, Math.min(max_ctx, contextLength / 2))
            // num_ctx 为min_ctx的倍数
            num_ctx = Math.ceil(num_ctx / min_ctx) * min_ctx;
            requestOption.options = {
                num_ctx: num_ctx
            }
        }

        if (modelName.indexOf('deepseek') !== -1) {
            if (isOllama) {
                requestOption.options.temperature = 0.6;
            } else {
                requestOption.temperature = 0.6;
            }
        }

        let res: any;
        if (isOllama) {
            res = await ollama.chat(requestOption);
        } else {
            const modelService = new ModelService(supplierName);
            try {
                res = await modelService.chat(requestOption);
            } catch (error) {
                logger.error(pub.lang('调用模型接口时出错:'), error);
                return pub.return_error(pub.lang('调用模型接口时出错'), error);
            }
        }

        // 设置HTTP响应头
        event.response.set("Content-Type", "text/event-stream;charset=utf-8");
        event.response.set("Connection", "keep-alive");
        event.response.status = 200;

        // 创建可读流
        const s = new Stream.Readable({
            read() { }
        });

        chatHistoryRes.content = "";

        // 处理大模型的流式响应
        (async () => {
            let resTimeMs = 0; // 开始响应时间(毫秒)
            let isThinking = false; // 是否正在推理
            let isThinkingEnd = false; // 是否推理结束
            for await (const chunk of res) {
                if (!isOllama) resTimeMs = new Date().getTime();
                if ((isOllama && chunk.done) ||
                    (!isOllama && (chunk.choices[0].finish_reason === 'stop' || chunk.choices[0].finish_reason === 'normal' || (chunk.choices[0]?.dalta?.content == "" && chunk.choices[0]?.delta?.reasoning_content == null)))) {
                    // 计算统计信息
                    let resInfo = {};
                    if (isOllama) {
                        resInfo = {
                            model: chunk.model,
                            created_at: chunk.created_at.toString(),
                            total_duration: chunk.total_duration / 1000000000,
                            load_duration: chunk.load_duration / 1000000,
                            prompt_eval_count: chunk.prompt_eval_count,
                            prompt_eval_duration: chunk.prompt_eval_duration / 1000000,
                            eval_count: chunk.eval_count,
                            eval_duration: chunk.eval_duration / 1000000000,
                        };
                    } else {
                        let nowTime = pub.time();
                        resInfo = {
                            model: modelStr,
                            created_at: chunk.created,      // 对话开始时间
                            total_duration: nowTime - chunk.created,           // 总时长
                            load_duration: 0,
                            prompt_eval_count: chunk.usage?.prompt_tokens || 0,
                            prompt_eval_duration: chunk.created * 1000 - resTimeMs,
                            eval_count: chunk.usage?.completion_tokens || 0,
                            eval_duration: nowTime - resTimeMs / 1000,
                        }
                    }
                    chatHistoryRes.created_at = chunk.created_at ? chunk.created_at.toString() : chunk.created;
                    chatHistoryRes.create_time = chunk.created ? chunk.created : pub.time();
                    chatHistoryRes.stat = resInfo;

                    // 结束流
                    s.push(null);

                    this.set_chat_history(uuid, resUUID, chatHistoryRes);
                    break;
                }

                // 写入流
                if (isOllama) {
                    s.push(chunk.message.content);
                    chatHistoryRes.content += chunk.message.content;
                } else {

                    if (chunk.choices[0]?.delta?.reasoning_content) {
                        let reasoningContent = chunk.choices[0]?.delta?.reasoning_content || '';
                        if (!isThinking) {
                            isThinking = true;
                            if (reasoningContent.indexOf('<think>') === -1) {
                                s.push('\n<think>\n');
                                chatHistoryRes.content += '\n<think>\n';
                            }
                        }
                        s.push(reasoningContent);
                        chatHistoryRes.content += reasoningContent;
                        if (reasoningContent.indexOf('</think>') !== -1) {
                            isThinkingEnd = true;
                        }
                    } else {
                        if (isThinking) {
                            isThinking = false;
                            if (!isThinkingEnd) {
                                s.push('\n</think>\n');
                                chatHistoryRes.content += '\n</think>\n';
                                isThinkingEnd = true;
                            }
                        }
                        s.push(chunk.choices[0]?.delta?.content || '');
                        chatHistoryRes.content += chunk.choices[0]?.delta?.content || '';
                    }
                }

                // 检查是否中断生成
                if (!ContextStatusMap.get(uuid)) {
                    // 中断请求
                    if (isOllama) res.abort();
                    // 结束流
                    let endContent = pub.lang("\n\n---\n**内容不完整:** 用户手动停止生成");
                    chatHistoryRes.content += endContent;
                    s.push(endContent);
                    s.push(null);
                    this.set_chat_history(uuid, resUUID, chatHistoryRes);
                    break;
                }
            }
        })();

        return s;
    }

    /**
     * 获取指定对话信息
     * @param {Object} args - 获取对话信息所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @returns {Promise<any>} - 包含对话信息的成功响应
     */
    async get_chat_info(args: { context_id: string }): Promise<any> {
        const { context_id: uuid } = args;
        const chatService = new ChatService();
        // 获取对话历史
        const data = chatService.get_chat_history(uuid);
        // 返回成功响应
        return pub.return_success(pub.lang("对话信息获取成功"), data);
    }

    /**
     * 删除指定对话
     * @param {Object} args - 删除对话所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @returns {Promise<any>} - 删除成功的响应
     */
    async remove_chat(args: { context_id: string }): Promise<any> {
        const { context_id: uuid } = args;
        const chatService = new ChatService();
        // 删除对话
        chatService.delete_chat(uuid);
        // 删除对话状态
        if (ContextStatusMap.has(uuid)) {
            ContextStatusMap.delete(uuid);
        }
        // 返回成功响应
        return pub.return_success(pub.lang("对话删除成功"), null);
    }

    /**
     * 修改对话标题
     * @param {Object} args - 修改对话标题所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @param {string} args.title - 新的对话标题
     * @returns {Promise<any>} - 修改结果的响应
     */
    async modify_chat_title(args: { context_id: string; title: string }): Promise<any> {
        const { context_id: uuid, title } = args;
        const chatService = new ChatService();
        // 更新对话标题
        if (chatService.update_chat_title(uuid, title)) {
            return pub.return_success(pub.lang("标题修改成功"), null);
        } else {
            return pub.return_error(pub.lang("标题修改失败"), pub.lang("指定对话不可用"));
        }
    }

    /**
     * 删除指定对话历史
     * @param {Object} args - 删除对话历史所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @param {string} args.id - 要删除的历史记录的唯一标识符
     * @returns {Promise<any>} - 删除成功的响应
     */
    async delete_chat_history(args: { context_id: string; id: string }): Promise<any> {
        const { context_id: uuid, id: history_id } = args;
        const chatService = new ChatService();
        // 删除对话历史记录
        chatService.delete_chat_history(uuid, history_id);
        // 返回成功响应
        return pub.return_success(pub.lang("对话历史删除成功"), null);
    }

    /**
     * 中断生成
     * @param {Object} args - 中断生成所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @returns {Promise<any>} - 中断成功的响应
     */
    async stop_generate(args: { context_id: string }): Promise<any> {
        const { context_id: uuid } = args;
        // 设置对话状态为中断
        ContextStatusMap.set(uuid, false);
        // 返回成功响应
        return pub.return_success(pub.lang("已阻止大模型继续生成内容"), null);
    }

    /**
     * 获取指定对话的最后一条历史记录
     * @param {Object} args - 获取最后一条历史记录所需的参数
     * @param {string} args.context_id - 对话的唯一标识符
     * @returns {Promise<any>} - 包含最后一条历史记录的成功响应
     */
    async get_last_chat_history(args: { context_id: string }): Promise<any> {
        const { context_id: uuid } = args;
        const chatService = new ChatService();
        // 获取最后一条历史记录
        const data = chatService.get_last_chat_history(uuid);
        // 返回成功响应
        return pub.return_success(pub.lang("最后一条历史对话记录获取成功"), data);
    }
}

/**
 * 重写 ChatController 类的 toString 方法，方便调试和日志输出
 * @returns {string} - 类的字符串表示
 */
ChatController.toString = () => '[class ChatController]';

export default ChatController;
