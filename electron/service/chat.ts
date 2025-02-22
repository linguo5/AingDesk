import { logger } from 'ee-core/log';
import { pub } from '../class/public';
import * as path from 'path';

/**
 * 定义聊天历史记录的类型
 * @property {string} id - 唯一标识
 * @property {string} reasoning - 推理信息
 * @property {string} role - 角色
 * @property {string} content - 聊天内容
 * @property {string[]} images - 图片数组
 * @property {string} tool_calls - 工具调用信息
 * @property {string} created_at - 创建时间字符串
 * @property {number} create_time - 创建时间戳
 * @property {object} stat - 统计信息
 * @property {number} tokens - tokens 数量
 */
export type ChatHistory = {
    id: string;
    reasoning: string;
    role: string;
    content: string;
    images: string[];
    tool_calls: string;
    created_at: string;
    create_time: number;
    stat: object;
    tokens: number;
    search_result: any[];
    search_type: string | undefined | null;
    search_query: string | undefined | null;
};

/**
 * 定义聊天上下文的类型
 * @property {string} role - 角色
 * @property {string} content - 聊天内容
 * @property {string[]} images - 图片数组
 * @property {string} tool_calls - 工具调用信息
 */
export type ChatContext = {
    role: string;
    content: string;
    images: string[];
    tool_calls: string;
};

/**
 * 聊天服务类，提供与聊天对话相关的各种操作
 */
export class ChatService {
    /**
     * 根据 UUID 获取上下文路径
     * @param {string} uuid - 对话的唯一标识符
     * @returns {string} - 上下文路径
     */
    private getContextPath(uuid: string): string {
        return pub.get_context_path(uuid);
    }

    /**
     * 根据 UUID 获取对话配置文件的完整路径
     * @param {string} uuid - 对话的唯一标识符
     * @returns {string} - 配置文件的完整路径
     */
    private getConfigFilePath(uuid: string): string {
        const contextPath = this.getContextPath(uuid);
        return path.resolve(contextPath, 'config.json');
    }

    /**
     * 根据 UUID 获取对话历史记录文件的完整路径
     * @param {string} uuid - 对话的唯一标识符
     * @returns {string} - 历史记录文件的完整路径
     */
    private getHistoryFilePath(uuid: string): string {
        const contextPath = this.getContextPath(uuid);
        return path.resolve(contextPath, 'history.json');
    }

    /**
     * 读取指定路径的 JSON 文件并解析为对象
     * @param {string} filePath - 文件的完整路径
     * @returns {any} - 解析后的 JSON 对象，如果文件不存在或解析失败则返回空数组
     */
    private readJsonFile(filePath: string): any {
        // 检查文件是否存在
        if (!pub.file_exists(filePath)) {
            return [];
        }
        // 读取文件内容
        const fileContent = pub.read_file(filePath);
        // 检查文件内容是否为空
        if (fileContent.length === 0) {
            return [];
        }
        try {
            // 尝试解析 JSON 内容
            return JSON.parse(fileContent);
        } catch (error) {
            // 记录解析错误信息
            logger.error(`解析 JSON 文件 ${filePath} 时出错:`, error);
            return [];
        }
    }

    /**
     * 将数据保存为 JSON 文件到指定路径
     * @param {string} filePath - 文件的完整路径
     * @param {any} data - 要保存的数据
     */
    private saveJsonFile(filePath: string, data: any): void {
        try {
            // 将数据转换为 JSON 字符串并写入文件
            pub.write_file(filePath, JSON.stringify(data));
        } catch (error) {
            // 记录保存文件时的错误信息
            logger.error(`保存 JSON 文件 ${filePath} 时出错:`, error);
        }
    }

    /**
     * 创建一个新的聊天对话
     * @param {string} model - 使用的模型名称
     * @param {string} parameters - 模型的参数
     * @param {string} [title=""] - 对话的标题，默认为空字符串
     * @returns {object} - 包含对话配置信息的对象
     */
    create_chat(model: string, parameters: string, title: string = ""): object {
        // 记录创建对话的日志信息
        logger.info('create_chat', `${model}:${parameters}`);
        // 生成对话的唯一标识符
        const uuid = pub.uuid();
        // 限制标题长度不超过 18 个字符
        if (title.length > 18) {
            title = title.substring(0, 18);
        }
        // 构建对话配置对象
        const contextConfig = {
            model,
            title,
            parameters,
            contextPath: this.getContextPath(uuid),
            context_id: uuid,
            create_time: pub.time()
        };
        // 保存对话配置信息到文件
        this.saveJsonFile(this.getConfigFilePath(uuid), contextConfig);
        return contextConfig;
    }

    /**
     * 更新指定对话的模型信息
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} model - 新的模型名称
     * @param {string} parameters - 新的模型参数
     * @returns {boolean} - 如果更新成功返回 true，否则返回 false
     */
    update_chat_model(uuid: string, model: string, parameters: string): boolean {
        // 读取对话配置信息
        const contextConfigObj = this.readJsonFile(this.getConfigFilePath(uuid));
        // 检查配置信息是否为空
        if (Object.keys(contextConfigObj).length === 0) {
            return false;
        }
        // 更新模型和参数信息
        contextConfigObj.model = model;
        contextConfigObj.parameters = parameters;
        // 保存更新后的配置信息到文件
        this.saveJsonFile(this.getConfigFilePath(uuid), contextConfigObj);
        return true;
    }

    /**
     * 读取指定对话的配置信息
     * @param {string} uuid - 对话的唯一标识符
     * @returns {any} - 对话的配置信息对象，如果不存在则返回空数组
     */
    read_chat(uuid: string): any {
        return this.readJsonFile(this.getConfigFilePath(uuid));
    }

    /**
     * 保存指定对话的配置信息
     * @param {string} uuid - 对话的唯一标识符
     * @param {object} chatConfig - 要保存的对话配置信息对象
     */
    save_chat(uuid: string, chatConfig: object): void {
        this.saveJsonFile(this.getConfigFilePath(uuid), chatConfig);
    }

    /**
     * 读取指定对话的历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @returns {any[]} - 对话的历史记录数组，如果不存在则返回空数组
     */
    read_history(uuid: string): any[] {
        return this.readJsonFile(this.getHistoryFilePath(uuid));
    }

    /**
     * 保存指定对话的历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @param {any[]} history - 要保存的历史记录数组
     */
    save_history(uuid: string, history: any[]): void {
        this.saveJsonFile(this.getHistoryFilePath(uuid), history);
    }

    /**
     * 获取所有对话的列表，并按创建时间降序排序
     * @returns {object[]} - 包含所有对话配置信息的数组
     */
    get_chat_list(): object[] {
        // 获取根上下文路径
        const contextPath = this.getContextPath("");
        // 读取上下文目录下的所有子目录
        const contextDirList = pub.readdir(contextPath);
        const contextList: object[] = [];
        // 遍历每个子目录
        for (const dir of contextDirList) {
            // 获取配置文件的完整路径
            const configFilePath = path.resolve(dir, 'config.json');
            // 读取配置信息
            const contextConfigObj = this.readJsonFile(configFilePath);
            // 检查配置信息是否为空
            if (Object.keys(contextConfigObj).length === 0) {
                continue;
            }
            // 如果配置信息中没有创建时间，尝试从文件创建时间获取
            if (contextConfigObj.create_time === undefined) {
                const stat = pub.stat(configFilePath);
                if (stat) {
                    // 将文件创建时间转换为秒级时间戳
                    contextConfigObj.create_time = Math.floor(stat.birthtime.getTime() / 1000);
                } else {
                    contextConfigObj.create_time = 0;
                }
            }
            // 将配置信息添加到对话列表中
            contextList.push(contextConfigObj);
        }
        // 按创建时间降序排序
        contextList.sort((a: any, b: any) => b.create_time - a.create_time);
        return contextList;
    }

    /**
     * 获取指定对话的历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @returns {object[]} - 对话的历史记录数组
     */
    get_chat_history(uuid: string): object[] {
        return this.read_history(uuid);
    }

    /**
     * 构造传递给模型的历史对话记录，根据上下文长度进行截断
     * @param {string} uuid - 对话的唯一标识符
     * @param {ChatContext} chatContext - 当前的聊天上下文
     * @param {number} contextLength - 上下文的最大长度
     * @returns {object[]} - 构造后的历史对话记录数组
     */
    build_chat_history(uuid: string, chatContext: ChatContext, contextLength: number): object[] {
        // 读取对话的历史记录
        let contextList = this.read_history(uuid);
        // 计算当前聊天上下文和历史记录的总 tokens 数量
        let totalTokens = chatContext.content.length;
        for (const item of contextList) {
            totalTokens += item.content.length;
        }
        // 计算历史记录的最大上下文长度
        const historyMaxContextLength = Math.round(contextLength * 0.5);
        // 如果总 tokens 数量超过最大上下文长度，逐步移除最早的历史记录
        while (totalTokens > historyMaxContextLength && contextList.length > 0) {
            const firstHistory = contextList.shift();
            if (firstHistory) {
                totalTokens -= firstHistory.content.length;
            }
        }
        // 提取历史记录中的角色和内容信息
        const historyList = contextList.map(item => ({ role: item.role, content: item.content }));
        // 添加当前聊天上下文到历史记录中
        historyList.push(chatContext);
        return historyList;
    }

    /**
     * 保存对话的历史记录，并根据上下文长度进行截断
     * @param {string} uuid - 对话的唯一标识符
     * @param {ChatHistory} history - 要保存的聊天历史记录
     * @param {number} contextLength - 上下文的最大长度
     */
    save_chat_history(uuid: string, history: ChatHistory, historyRes:ChatHistory, contextLength: number,regenerate_id:string|undefined): void {
        // 为历史记录生成唯一标识符
        history.id = pub.uuid();
        // 计算历史记录的 tokens 数量
        history.tokens = history.content ? history.content.length : 0;
        // 读取对话的历史记录
        let historyList = this.read_history(uuid);
        // 计算总 tokens 数量
        let totalTokens = history.tokens;
        // 计算历史记录的最大上下文长度
        const historyMaxContextLength = Math.round(contextLength * 0.5);

        historyRes.content = pub.lang("意外中断");

        if(regenerate_id){
            let index = historyList.findIndex((item) => item.id == regenerate_id);
            if(index > -1){
                // 移除指定ID之后的所有历史记录
                historyList = historyList.slice(0,index);
            }
        }else{
            // 添加新的提问记录到列表中
            historyList.push(history);
        }

        historyList.push(historyRes);
        // 如果总 tokens 数量超过最大上下文长度，逐步移除最早的历史记录
        while (totalTokens > historyMaxContextLength && historyList.length > 0) {
            const firstHistory = historyList.shift();
            if (firstHistory) {
                totalTokens -= firstHistory.tokens;
            }
        }
        // 保存更新后的历史记录到文件
        this.save_history(uuid, historyList);
    }

    /**
     * 修正对话的历史记录
     * @param uuid <string> 对话的唯一标识符
     * @param id <string> 要修正的历史记录的唯一标识符
     * @param history <ChatHistory> 修正后的聊天历史记录
     */
    set_chat_history(uuid: string,id:string, history: ChatHistory): void {
        let historyList = this.read_history(uuid);
        let index = historyList.findIndex((item) => item.id == id);
        historyList[index] = history;
        this.save_history(uuid, historyList);
    }




    /**
     * 删除指定对话及其相关文件
     * @param {string} uuid - 对话的唯一标识符
     */
    delete_chat(uuid: string): void {
        // 获取对话的上下文路径
        const contextPath = this.getContextPath(uuid);
        try {
            // 删除上下文目录
            pub.rmdir(contextPath);
        } catch (error) {
            // 记录删除对话时的错误信息
            logger.error(`删除对话 ${uuid} 时出错:`, error);
        }
    }

    /**
     * 更新指定对话的标题
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} title - 新的对话标题
     * @returns {boolean} - 如果更新成功返回 true，否则返回 false
     */
    update_chat_title(uuid: string, title: string): boolean {
        // 读取对话的配置信息
        const contextConfigObj = this.read_chat(uuid);
        // 检查配置信息是否为空
        if (Object.keys(contextConfigObj).length === 0) {
            return false;
        }
        // 更新对话标题
        contextConfigObj.title = title;
        // 保存更新后的配置信息到文件
        this.save_chat(uuid, contextConfigObj);
        return true;
    }

    /**
     * 删除指定对话中的某条历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @param {string} id - 要删除的历史记录的唯一标识符
     */
    delete_chat_history(uuid: string, id: string): void {
        // 读取对话的历史记录
        const historyList = this.read_history(uuid);
        // 过滤掉要删除的历史记录
        const newHistoryList = historyList.filter(item => item.id !== id);
        // 保存更新后的历史记录到文件
        this.save_history(uuid, newHistoryList);
    }

    /**
     * 获取指定对话的最后一条历史记录
     * @param {string} uuid - 对话的唯一标识符
     * @returns {object} - 最后一条历史记录对象，如果不存在则返回空对象
     */
    get_last_chat_history(uuid: string): object {
        // 读取对话的历史记录
        const historyList = this.read_history(uuid);
        return historyList[historyList.length - 1] || {};
    }
}

/**
 * 重写 ChatService 类的 toString 方法，方便调试和日志输出
 * @returns {string} - 类的字符串表示
 */
ChatService.toString = () => '[class ChatService]';

/**
 * 导出 ChatService 类的单例实例
 */
export const chatService = new ChatService();
