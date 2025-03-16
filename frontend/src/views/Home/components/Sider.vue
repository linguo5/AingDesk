<template>
  <div class="layout-sider-wrapper">
    <div class="logo">
      <div class="logo-left">
        <NImage :src="logo" object-fit="cover" class="h-30" preview-disabled />
        <span class="text-[var(--bt-tit-color-secondary)]">AiChat</span>
      </div>
      <div>
        <i class="i-common:fold w-18 h-18 cursor-pointer" @click="doFold"></i>
      </div>
    </div>

    <div class="flex justify-center items-center">
      <NButton type="default" style="width: 100%" @click="createNewComu">
        <template #icon>
          <i class="i-tdesign:chat-add w-16 h-16"></i>
        </template>
        {{ $t("新建对话") }}
      </NButton>
    </div>

    <div class="recent-header">
      <span class="ml-8 text-[var(--bt-notice-text-color)]">{{ $t("对话") }}</span>
    </div>

    <div class="sider-wrapper" style="overflow: hidden">
      <!-- 侧边栏上部分 -->
      <NScrollbar :style="{ height: '100%' }">
        <div class="sider-top">
          <div class="recent-comunication">
            <!-- 最近对话列表 -->
            <ul class="recent-list">
              <li :class="{ active: currentContextId == item.context_id }" @click.stop="handleChoose($event, item)" v-for="item in chatList" :key="item.context_id">
                <div class="flex items-center" style="height: 100%">
                  <i class="i-tdesign:chat w-16 h-16 mr-10 ml-8 text-[var(--bt-tit-color-secondary)]"></i>
                  <div class="comu-title">{{ item.title ? item.title : $t("对话内容") }}</div>
                </div>

                <NPopselect
                  trigger="click"
                  :options="[
                    { label: $t('删除对话'), value: 'delChat' },
                    { label: $t('修改标题'), value: 'modifyTitle' },
                  ]"
                  :on-update:value="(val) => doChatOperateSelect(val, item.context_id)">
                  <div class="flex justify-center items-center" style="height: 100%; padding: 0 8px">
                    <i class="i-common:more-operation w-16 h-16"></i>
                  </div>
                </NPopselect>
              </li>
            </ul>
          </div>
        </div>
      </NScrollbar>
      <div class="sider-divider"></div>
    </div>

    <div class="recent-header">
      <span class="text-[var(--bt-notice-text-color)] flex justify-start items-center">{{ $t("知识库") }}</span>
    </div>

    <!-- 知识库 -->
    <div class="sider-wrapper" style="overflow: hidden; gap: 10px">
      <NScrollbar :style="{ height: '100%' }">
        <div class="sider-top">
          <div class="recent-comunication">
            <!-- 列表 -->
            <ul class="recent-list">
              <li :class="[{ active: item.ragName == activeKnowledge }]" @click="openKnowledgeStore(item)" v-for="item in knowledgeList">
                <div class="flex items-center" style="height: 100%">
                  <i class="i-tdesign:folder w-16 h-16 mr-10 ml-8 text-[var(--bt-tit-color-secondary)]"></i>
                  <div class="comu-title">{{ item.ragName }}</div>
                </div>

                <NPopselect
                  trigger="click"
                  :options="[
                    { label: $t('删除'), value: 'delChat' },
                    { label: $t('修改'), value: 'modifyTitle' },
                  ]"
                  :on-update:value="(val) => dealPopOperation(val, item)">
                  <div class="flex justify-center items-center" style="height: 100%; padding: 0 8px" @click.stop>
                    <i class="i-common:more-operation w-16 h-16"></i>
                  </div>
                </NPopselect>
              </li>

              <li @click.stop="createNewKnowledgeStore" :class="{ 'add-knowledge': addingKnowledge }">
                <div class="flex items-center" style="height: 100%">
                  <i class="i-tdesign:folder-add w-16 h-16 mr-10 ml-8 text-[var(--bt-tit-color-secondary)]"></i>
                  <div class="comu-title">{{ $t("新建知识库") }}</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </NScrollbar>
    </div>

    <!-- 侧边栏下部分 -->
    <div class="sider-bottom">
      <div class="sider-divider"></div>

      <ul class="recent-list">
        <li @click="openThirdPartyModel">
          <div class="flex items-center justify-start">
            <i class="i-common:model-manage w-16 h-16 ml-8 mr-10 text-[var(--bt-tit-color-secondary)]"></i>
            <span>{{ $t("模型管理") }}</span>
          </div>
        </li>
        <li @click="openSoftSettings">
          <div class="flex items-center justify-start">
            <i class="i-tdesign:setting-1 w-16 h-16 ml-8 mr-10 text-[var(--bt-tit-color-secondary)]"></i>
            <span>{{ $t("设置") }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>

  <!-- 删除对话问询 -->
  <NModal v-model:show="chatRemoveConfirm" :close-on-esc="false" :closable="false" :mask-closable="false">
    <NCard :title="$t('删除对话')" style="width: 45%; max-width: 460px">
      <template #header-extra>
        <i class="i-common:close w-24 h-24 cursor-pointer" @click="chatRemoveConfirm = false"></i>
      </template>
      {{ $t("是否确认删除当前对话") }}
      <div class="modal-footer">
        <NButton type="default" ghost @click="chatRemoveConfirm = false">{{ $t("取消") }}</NButton>
        <NButton type="error" ghost @click="removeChat(contextIdForDel)">{{ $t("删除") }}</NButton>
      </div>
    </NCard>
  </NModal>

  <!-- 修改对话标题确认框 -->
  <NModal v-model:show="chatModifyConfirm" :close-on-esc="false" :closable="false" :mask-closable="false">
    <NCard :title="$t('修改对话标题')" style="width: 45%; max-width: 460px">
      <template #header-extra>
        <i class="i-common:close w-24 h-24 cursor-pointer" @click="chatModifyConfirm = false"></i>
      </template>
      <NInput v-model:value="newChatTitle" :placeholder="$t('请输入新的对话标题')" @keydown.enter="modifyChatTitle({ context_id: contextIdForModify, title: newChatTitle })" />
      <div class="modal-footer">
        <NButton type="default" ghost @click="chatModifyConfirm = false">{{ $t("取消") }}</NButton>
        <NButton type="success" ghost @click="modifyChatTitle({ context_id: contextIdForModify, title: newChatTitle })">{{ $t("确认") }} </NButton>
      </div>
    </NCard>
  </NModal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { NModal, NButton, NImage, NCard, NPopselect, NInput, NSwitch, NScrollbar, NTooltip, NInputGroup } from "naive-ui";
import { get_chat_list, removeChat, modifyChatTitle, getChatInfo, openKnowledgeStore, openThirdPartyModelApi, openSoftSettings, createNewKnowledgeStore, removeRag, removeRagConfirm, modifyRag, createNewComu, singleActive, openModelManage, getSupplierList } from "../controller";
import useIndexStore, { type ChatItemInfo, type KnowledgeDocumentInfo } from "../store";
import { storeToRefs } from "pinia";
import logoImage from "@/assets/images/logo.png";
import logoDark from "@/assets/images/logo-dark.png";

import { useI18n } from "vue-i18n";
const { t: $t } = useI18n();
const { chatList, currentContextId, siderWidth, isFold, settingsShow, chatRemoveConfirm, contextIdForDel, isInstalledManager, managerInstallConfirm, contextIdForModify, chatModifyConfirm, newChatTitle, chatHistory, currentChatTitle, currentModel, userScrollSelf, themeMode, knowledgeList, addingKnowledge, activeKnowledge, createKnowledgeFormData, currentChatKnowledge, currentChatSearch, activeKnowledgeForChat, netActive, thirdPartyApiShow, currentSupplierName, currentModelDto } = storeToRefs(useIndexStore());

/* const chartPopSelectOptions = ref<{ label: string, value: string }[]>([
    { label: $t("删除对话"), value: "delChat" },
    { label: $t("修改标题"), value: "modifyTitle" }
]) */

/**
 * @description 计算不同模式下logo的图片
 */

const logo = computed(() => {
  if (themeMode.value == "light") {
    return logoImage;
  } else {
    return logoDark;
  }
});

/**
 * @description 获取历史对话列表
 */
get_chat_list();

/**
 * @description 选择已有对话
 */
async function handleChoose(e: MouseEvent, chat: ChatItemInfo) {
  if ((e.target! as HTMLElement).classList.contains("i-common:more-operation")) {
    return;
  } else {
    userScrollSelf.value = false;
    await get_chat_list();
    currentContextId.value = chat.context_id;
    currentChatTitle.value = chat.title;
    if (chat.supplierName == "ollama") {
      currentModel.value = `${chat.model}:${chat.parameters}`;
    } else {
      currentModel.value = `${chat.model}`;
    }
    currentSupplierName.value = chat.supplierName!;
    currentModelDto.value = {
      model: chat.model,
      parameters: chat.parameters,
      supplierName: chat.supplierName!,
    };
    getChatInfo(currentContextId.value);
    singleActive("chat", chat.context_id);
  }
  activeKnowledgeForChat.value = chat.rag_list ? chat.rag_list : [];
  chat.search_type ? (netActive.value = true) : (netActive.value = false);
}

/**
 * @description 对话操作
 */
function doChatOperateSelect(val: string, context_id: string) {
  if (val == "delChat") {
    contextIdForDel.value = context_id;
    chatRemoveConfirm.value = true;
  } else if (val == "modifyTitle") {
    contextIdForModify.value = context_id;
    newChatTitle.value = "";
    chatModifyConfirm.value = true;
  }
}

/**
 * @description 折叠侧边栏
 */
function doFold() {
  siderWidth.value = 0;
  isFold.value = true;
}

/**
 * @description 删除指定对话
 */
function doChatDel(contextId: string) {
  contextIdForDel.value = contextId;
  chatRemoveConfirm.value = true;
}

/***
 * @description 知识库操作
 */
function dealPopOperation(val: string, knowledge: any) {
  console.log(knowledge);
  if (val == "delChat") {
    removeRagConfirm(knowledge.ragName);
  } else {
    createKnowledgeFormData.value.enbeddingModel = knowledge.embeddingModel;
    createKnowledgeFormData.value.ragName = knowledge.ragName;
    createKnowledgeFormData.value.ragDesc = knowledge.ragDesc;
    createKnowledgeFormData.value.supplierName = knowledge.supplierName;
    modifyRag();
  }
}

/**
 * @description 打开第三方模型弹窗
 */
function openThirdPartyModel() {
  thirdPartyApiShow.value = true;
  getSupplierList();
}

// /**
//  * @description 点击空白取消知识库添加
//  */
// document.addEventListener(("click"), (e) => {
//     addingKnowledge.value = false
// })

// /**
//  * @description 新建知识库时文本框是否聚焦
//  */
// watch(addingKnowledge, (val) => {
//     nextTick(() => {
//         if (val) {
//             const inputDom = document.querySelector("#focus-input")?.querySelector("input")
//             inputDom?.focus()
//         }
//     })
// })
</script>

<style scoped lang="scss">
@use "@/assets/base";

@mixin comu-list-item {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  text-align: left;
  cursor: pointer;
  transition: 0.2s;

  &:hover {
    background-color: base.$list-item-hover;
  }
}

@mixin comu-tit {
  width: 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@mixin recent-list-style {
  box-sizing: border-box;
  margin-top: var(--bt-mg-small);

  li {
    @include base.row-flex-between;
    @include base.common-list-item;

    &:hover:not(.add-knowledge) {
      background-color: base.$list-item-hover;
    }

    &.active {
      background-color: base.$list-item-hover;
    }

    .comu-title {
      @include comu-tit;
    }
  }

  .pd-10 {
    padding: 0 0 0 var(--bt-pd-small);
    width: 100%;
    text-align: left;

    :deep(.n-button__content) {
      align-items: flex-start;
    }
  }
}

.layout-sider-wrapper {
  display: grid;
  // grid-template-rows: 50px 22px 2fr 22px 1fr 140px;
  grid-template-rows: 50px 64px 22px 2fr 22px 1fr 140px;
  height: 100%;
  box-sizing: border-box;
  padding: var(--bt-pd-small);

  .logo {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .logo-left {
      display: flex;
      gap: 10px;
      justify-content: flex-start;
      align-items: center;

      span {
        font-size: 18px;
        font-weight: bold;
      }
    }
  }

  .sider-wrapper {
    --hover-bg: #e3e3e3;
    --item-border-radius: 10px;

    box-sizing: border-box;
    @include base.row-flex-between;
    gap: var(--bt-mg-normal);
    flex-direction: column;

    .sider-top {
      width: 100%;

      .recent-comunication {
        width: 100%;
      }
    }

    /* .search-comunication {
        position: relative;
        width: 100%;

        .search-icon {
            position: absolute;
            top: 8px;
            left: 4px;
        }

        :deep(.search-input) {
            --n-border:none !important;
            --n-placeholder-color:#727272 !important;
            height: var(--item-height);
            outline: none !important;
            border-radius: 8px;
            background-color: #F3F4F6;
            text-indent: 18px;
            line-height: 30px;
        }
    } */
  }

  .sider-bottom {
    width: 100%;
  }
}

.modal-footer {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  margin-top: 40px;
  gap: 20px;
}

.recent-list {
  @include recent-list-style;
}

.create-comunication {
  @include comu-list-item;
}

.recent-header {
  @include base.row-flex-between;
  margin: var(--bt-mg-small) 0;
  box-sizing: border-box;
}

.sider-divider {
  height: 1px;
  width: calc(100% - var(--bt-pd-normal) * 2);
  background-color: rgba(0, 0, 0, 0.12);
  margin: var(--bt-mg-small) auto;
}

.knowledge-store-list {
  .create-comunication {
    @include comu-list-item;

    .comu-tit {
      @include comu-tit;
    }
  }

  .knowledge-list {
    @include recent-list-style;
  }
}
</style>
