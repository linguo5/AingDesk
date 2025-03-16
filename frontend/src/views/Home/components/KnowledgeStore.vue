<template>
  <div class="knowledge-store">
    <div class="header">
      <div class="header-tit">
        <i class="i-tdesign:folder w-20 h-20"></i>
        <NTooltip trigger="hover">
          <template #trigger>
            <span class="tit">{{ activeKnowledge }}</span>
          </template>
          {{ activeKnowledge }}
        </NTooltip>
        <!-- <i class="i-tdesign:folder w-16 h-16 mr-10 ml-8"></i>
                <span class="">{{ activeKnowledge }}</span> -->
        <i class="i-common:fold w-18 h-18 cursor-pointer" @click="knowledgeIsClose"></i>
      </div>
      <!-- <div class="header-desc">
                <div class="desc-holderplace">{{ activeKnowledgeDto?.ragDesc }}</div>
            </div> -->
    </div>
    <NDivider style="margin-top: 11px; margin-bottom: 10px" />
    <div class="knowledge-list">
      <NButton @click="openDocUploadDialog" style="width: 100%" class="mt-10 mb-10">
        <template #icon>
          <i class="i-tdesign:file-add w-16 h-16"></i>
        </template>
        {{ $t("上传文件") }}
      </NButton>
      <div class="files-info">
        <span class="text-[#73767a]">{{ $t("{0}个文件", [activeKnowledgeDocList.length]) }}</span>
        <span>
          <!-- <NTooltip ttrigger="hover">
                        <template #trigger>
                            <i class="i-tdesign:file-add w-16 h-16 text-[#909399] cursor-pointer"
                                @click="openDocUploadDialog"></i>
                        </template>
                        上传文件
                    </NTooltip> -->
        </span>
      </div>

      <div style="overflow: hidden">
        <NScrollbar style="height: 100%">
          <div class="flex justify-start items-center gap-1.25" v-if="docParseStatus"><i class="i-svg-spinners:180-ring-with-bg w-20 h-20 text-[var(--bt-theme-warning)] ml-8"></i>{{ $t("文档嵌入中，请稍后") }}...</div>
          <ul class="list">
            <li v-for="item in activeKnowledgeDocList" :key="item.doc_name" @click="getDocContent(item)">
              <NPopover trigger="hover" placement="right">
                <template #trigger>
                  <div class="list-item">
                    <i class="i-tdesign:file w-19 h-19 text-[#73767a] ml-8 mr-10"></i><span class="title">{{ item.doc_name }}</span>
                  </div>
                </template>
                <div class="item-content">
                  <div class="tit">{{ item.doc_name }}</div>
                  <div class="time text-[var(--bt-notice-text-color)]">{{ $t("上传时间") }}: {{ isoToLocalDateTime(item.update_time * 1000) }}</div>
                  <div class="desc">{{ $t("AI摘要") }}: {{ item.doc_abstract }}</div>
                  <div class="text-[var(--bt-theme-color)]" v-if="item.is_parsed == 1">{{ $t("已嵌入完成, 可正常调用") }}</div>
                  <div class="text-[var(--bt-theme-warning)]" v-else>{{ $t("正在嵌入中, 等待时长视文件数量，这可能需要几分钟到十几分钟") }}</div>
                </div>
              </NPopover>
              <i class="i-ri:close-circle-line w-20 h-20 text-[#909399] del-icon" @click="delKnowledgeDoc(item)"></i>
            </li>
          </ul>
        </NScrollbar>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NDivider, NTooltip, NPopover, NButton, NUpload, type UploadFileInfo, NScrollbar } from "naive-ui";
import useIndexStore from "../store";
import { storeToRefs } from "pinia";
import { isoToLocalDateTime } from "@/utils/tools";
import { getRagList, openDocUploadDialog, delKnowledgeDoc, knowledgeIsClose, getDocContent } from "../controller";
import { useI18n } from "vue-i18n";
const { t: $t } = useI18n();
// 获取知识库列表
getRagList();

const { activeKnowledge, activeKnowledgeDto, knowledgeList, activeKnowledgeDocList, docParseStatus } = storeToRefs(useIndexStore());
const uploadUrl = import.meta.env.BASE_URL;

function chooseFilesChange(files: any) {
  console.log(files);
}
</script>

<style scoped lang="scss">
@use "@/assets/base";

@mixin line-ellipsis {
  width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.knowledge-store {
  box-sizing: border-box;
  padding: 14px;
  width: 240px;
  height: 100%;
  display: grid;
  grid-template-rows: 34px 20px 1fr;

  .header {
    .header-tit {
      @include base.row-flex-between;
      justify-content: flex-start;
      gap: 10px;

      .tit {
        font-size: 18px;
        @include line-ellipsis;
      }
    }

    .header-desc {
      margin-top: 14px;

      .desc-holderplace {
        color: base.$notice-text;
        font-size: 12px;
      }
    }
  }

  .knowledge-list {
    display: grid;
    grid-template-rows: 54px 35px 1fr;
    overflow: hidden;

    .list {
      width: 100%;
      height: 100%;
      overflow: hidden;

      li {
        position: relative;

        .list-item {
          @include base.row-flex-between;
          @include base.common-list-item;
          justify-content: flex-start;
          gap: 0px;
          margin: 10px 0;

          &:hover {
            background-color: base.$list-item-hover;
          }

          .tit-icon {
            background: #085684;
            color: #fff;
            width: 24px;
            height: 24px;
            font-size: 12px;
            border-radius: 50%;
            @include base.row-flex-between;
            justify-content: center;
          }

          .title {
            @include line-ellipsis;
          }
        }

        .del-icon {
          position: absolute;
          right: 2px;
          top: 8px;
          cursor: pointer;
          display: none;
        }

        &:hover {
          .del-icon {
            display: block;
          }
        }
      }
    }

    .files-info {
      @include base.row-flex-between;
      color: base.$secondary-text-color;
      font-size: 12px;
      margin-bottom: 10px;
      box-sizing: border-box;
      padding: 0 10px 0 10px;

      span {
        @include base.row-flex-between;
      }
    }
  }
}

.item-content {
  width: 380px;
  min-height: 300px;
  @include base.column-flex-center;
  justify-content: flex-start;
  align-items: flex-start;
  padding: 10px;
  box-sizing: border-box;

  .tit {
    @include base.row-flex-between;
    justify-content: start;
  }

  .time {
    font-size: 12px;
  }
}

.n-upload {
  @include base.column-flex-center;
}
</style>
