<template>
  <!-- 第三方api配置界面 -->
  <NModal :show="thirdPartyApiShow" preset="dialog" style="width: 740px" title="模型管理" :draggable="true" :show-icon="false">
    <template #close>
      <i class="i-tdesign:close-circle w-20 h-20 cursor-pointer text-[#909399]" @click="thirdPartyApiShow = false"></i>
    </template>
    <div class="api-config-wrapper" :segmented="{ content: true, footer: true }">
      <div class="api-config-content">
        <div class="model-list">
          <NList hoverable clickable>
            <NScrollbar style="height: 500px">
              <NListItem v-for="item in thirdPartyApiServiceList" :key="item.supplierName" :class="['cursor-pointer list-item', { active: item.supplierName == currentChooseApi?.supplierName }]" @click="chooseApiService(item)">
                <div class="flex justify-start items-center gap-1.25">
                  <NImage :src="item.icon" preview-disabled /><span>{{ item.supplierTitle }}</span>
                </div>
              </NListItem>
            </NScrollbar>
          </NList>
          <div class="add-supplier-btn mt-20">
            <NButton style="width: 100%" ghost @click="addSupplierShow = true">{{ $t("添加模型服务商") }}</NButton>
          </div>
        </div>
        <div class="config-panel" v-if="currentChooseApi">
          <div class="tit">
            <div class="flex justify-start items-center">
              <NTooltip trigger="hover">
                <template #trigger>
                  <i class="i-ci:circle-warning w-18 h-18 cursor-pointer" @click="jumpToHelp(currentChooseApi.help)"></i>
                </template>
                {{ $t("使用教程") }}
              </NTooltip>
              <span class="ml-5 mr-5">{{ currentChooseApi.supplierTitle }}</span>
            </div>
            <div class="flex justify-end items-center">
              <NSwitch style="margin-right: 20px" size="small" v-model:value="currentChooseApi.status" @update:value="(val) => changeCurrentSupplierStatus(currentChooseApi?.supplierName!, val)"> </NSwitch>
              <NTooltip trigger="hover" v-if="!currentChooseApi.home">
                <template #trigger>
                  <i class="i-weui:delete-outlined w-20 h-20 cursor-pointer mr-10" @click="delSupplier(currentChooseApi.supplierName)"></i>
                </template>
                {{ $t("删除服务商") }}
              </NTooltip>
            </div>
          </div>
          <div class="config-item">
            <div class="item-tit">
              {{ $t("API密钥") }}
            </div>
            <div class="config-form">
              <NInputGroup>
                <NInput type="password" :placeholder="$t('请输入API密钥')" v-model:value="applierServiceConfig.apiKey" />
                <NButton @click="checkConfig">{{ $t("检查") }}</NButton>
              </NInputGroup>
              <NButton type="info" text style="font-size: 12px; margin-top: 3px" @click="getKey(currentChooseApi.home)">{{ $t("点次获取密钥") }} </NButton>
            </div>
          </div>
          <div class="config-item">
            <div class="item-tit">
              {{ $t("API地址") }}
            </div>
            <div class="config-form">
              <NInputGroup>
                <NInput :placeholder="$t('请输入API地址')" v-model:value="applierServiceConfig.baseUrl" />
              </NInputGroup>
              <div style="font-size: 12px; color: rgb(177.3, 179.4, 183.6); margin-top: 3px">
                <span>{{ $t("示例") }}: </span>
                <span>{{ currentChooseApi.baseUrlExample }}</span>
              </div>
            </div>
          </div>
          <div class="config-item">
            <NButton type="primary" @click="saveConfig">{{ $t("保存API") }}</NButton>
          </div>
          <div class="config-model-list">
            <div class="tit">
              <div>
                {{ $t("模型") }}
                <span style="color: rgb(177.3, 179.4, 183.6); font-size: 12px; font-weight: normal">{{ $t("默认从/models获取所有模型") }}</span>
              </div>
              <div>
                {{ $t("开关所有") }}
                <NSwitch size="small" v-model:value="isAllModelEnable" @update:value="multipleModelStatusChange">
                  <!--  <template #checked>
                                        ON
                                    </template>
                                    <template #unchecked>
                                        OFF
                                    </template> -->
                </NSwitch>
              </div>
            </div>
            <div class="add-model">
              <NButton size="small" text @click="addSupplierModel = true">
                <template #icon>
                  <i class="i-proicons:add-circle w-18 h-18"></i>
                </template>
                {{ $t("添加模型") }}
              </NButton>
            </div>
            <NList hoverable>
              <NScrollbar style="height: 200px">
                <NListItem v-for="item in supplierModelList" :key="item.modelName" v-if="supplierModelList.length">
                  <div class="model-item">
                    <NInputGroup v-if="currentModelNameForEdiit == item.modelName">
                      <NInput v-model:value="modelTitTemp" />
                      <NButton @click="cancelEditModelTit">{{ $t("取消") }}</NButton>
                      <NButton @click="confirmEditModelTit" type="primary">{{ $t("确认") }} </NButton>
                    </NInputGroup>
                    <template v-else>
                      <div class="flex items-center justify-start gap-1.25">
                        <span>{{ item.title }}</span>
                        <NTooltip trigger="hover">
                          <template #trigger>
                            <i class="i-proicons:text-edit-style w-16 h-16 mr-20 cursor-pointer" @click="currentModelNameForEdiit = item.modelName"></i>
                          </template>
                          {{ $t("修改别名") }}
                        </NTooltip>
                        <NTag v-for="_item in item.capability" size="small">{{ _item }}</NTag>
                      </div>
                    </template>
                    <div class="operation">
                      <NSwitch size="small" v-model:value="item.status" @update:value="(val) => modelStatusChange(item.modelName, val)">
                        <!--  <template #checked>
                                                    ON
                                                </template>
                                                <template #unchecked>
                                                    OFF
                                                </template> -->
                      </NSwitch>
                      <i class="i-weui:delete-outlined w-20 h-20 cursor-pointer hover:text-red-5" @click="delModel(item.modelName)"></i>
                    </div>
                  </div>
                </NListItem>
                <div v-else>{{ $t("当前服务商下属暂无模型可用") }}</div>
              </NScrollbar>
            </NList>
          </div>
        </div>
      </div>
      <!-- <template #footer>
                <div class="flex justify-end">
                    <NButton type="primary">确认</NButton>
                </div>
            </template> -->
    </div>
  </NModal>

  <!-- 添加模型 -->
  <NModal :show="addSupplierModel">
    <NCard :title="$t('添加模型')" class="add-model-wrapper">
      <NForm :model="addModelFormData" :rules="addModelRules" ref="addModelForm">
        <NFormItem :label="$t('模型ID')" path="modelName">
          <NInput :placeholder="$t('请输入模型ID')" v-model:value="addModelFormData.modelName" :on-update:value="modelIdChange" />
        </NFormItem>
        <NFormItem :label="$t('模型别名')" path="title">
          <NInput :placeholder="$t('请输入模型别名')" v-model:value="addModelFormData.title" />
        </NFormItem>
        <NFormItem :label="$t('模型功能')" path="capability">
          <NSelect :options="capabilityOptions" multiple v-model:value="addModelFormData.capability" :on-update:value="capabilityChange" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="action-wrapper">
          <NButton @click="closeAddModel">{{ $t("取消") }}</NButton>
          <NButton type="primary" @click="confirmAddModel">{{ $t("添加") }}</NButton>
        </div>
      </template>
    </NCard>
  </NModal>

  <!-- 添加模型服务商 -->
  <NModal :show="addSupplierShow">
    <NCard :title="$t('添加模型服务商')" class="add-supplier-wrapper">
      <NForm :model="addSupplierFormData" :rules="addSupplierFormRules" ref="addSupplierForm">
        <NFormItem :label="$t('供应商名称')" path="supplierTitle">
          <NInput v-model:value="addSupplierFormData.supplierTitle" />
        </NFormItem>
        <NFormItem :label="$t('接口地址')" path="apiKey">
          <div class="w-100%">
            <NInput v-model:value="addSupplierFormData.apiKey" />
            <span class="text-3 text-[#b1b3b8] inline-block mt-3px">{{ $t("需要兼容openAI格式的接口") }}</span>
          </div>
        </NFormItem>
        <NFormItem :label="$t('密钥')" path="baseUrl">
          <NInput type="password" v-model:value="addSupplierFormData.baseUrl" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="action-wrapper">
          <NButton @click="cancelAddSupplier">{{ $t("取消") }}</NButton>
          <NButton type="primary" @click="confirmAddSupplier">{{ $t("确认") }}</NButton>
        </div>
      </template>
    </NCard>
  </NModal>
</template>

<script setup lang="tsx">
import { ref } from "vue";
import { NModal, NCard, NList, NListItem, NSwitch, NInputGroup, NInput, NButton, NTooltip, NForm, NFormItem, NSelect, type SelectOption, NScrollbar, NTag, NImage } from "naive-ui";
import useIndexStore, { type ThirdPartyApiServiceItem } from "../store";
import { storeToRefs } from "pinia";
import { addModels, addSupplier, checkSupplierConfig, getSupplierConfig, getSupplierList, getSupplierModelList, removeSupplier, removeSupplierModel, setModelStatus, setModelTitle, setSupplierConfig, setSupplierStatus } from "../controller";
import { message, useDialog } from "@/utils/naive-tools";
import { useI18n } from "vue-i18n";
const { t: $t } = useI18n();
const { thirdPartyApiShow, thirdPartyApiServiceList, currentChooseApi, supplierModelList, addSupplierModel, addModelFormData, applierServiceConfig, isAllModelEnable, addSupplierShow, addSupplierFormData, currentModelNameForEdiit } = storeToRefs(useIndexStore());

const addModelForm = ref();
const cantChoose = ref(false);
const capabilityOptions = ref<SelectOption[]>([
  {
    label: "LLM",
    value: "llm",
    // @ts-ignore
    disabled: cantChoose,
  },
  {
    label: "Vision",
    value: "vision",
    // @ts-ignore
    disabled: cantChoose,
  },
  {
    label: "Embedding",
    value: "embedding",
  },
]);

const addModelRules = ref({
  modelName: [
    {
      required: true,
      message: $t("请输入模型ID"),
      trigger: "blur",
    },
  ],
  title: [
    {
      required: true,
      message: $t("请输入模型别名"),
      trigger: "blur",
    },
  ],
  capability: [
    {
      required: true,
      validator(_: any, value: Array<string>, callback: any) {
        if (value.length == 0) {
          return callback(new Error($t("请选择模型功能")));
        } else {
          return callback();
        }
      },
    },
  ],
});

const addSupplierForm = ref();
const addSupplierFormRules = ref({
  supplierTitle: [
    {
      required: true,
      message: $t("请输入供应商名称"),
      trigger: "blur",
    },
  ],

  apiKey: [
    {
      required: true,
      message: $t("请输入API密钥"),
      trigger: "blur",
    },
  ],
  baseUrl: [
    {
      required: true,
      message: $t("请输入API地址"),
      trigger: "blur",
    },
  ],
});

// 获取服务商列表
getSupplierList();

/**
 * @description 点击选中api服务商
 */
async function chooseApiService(item: ThirdPartyApiServiceItem) {
  currentChooseApi.value = item;
  await getSupplierModelList(item.supplierName);
  await getSupplierConfig(item);
}

/**
 * @description 关闭添加模型弹窗
 */
async function closeAddModel() {
  addSupplierModel.value = false;
  addModelFormData.value = {
    modelName: "",
    capability: [],
    title: "",
  };
}

/**
 * @description 模型id改变的回调
 */
async function modelIdChange(val: string) {
  addModelFormData.value.title = val;
  addModelFormData.value.modelName = val;
}

/**
 * @description 确认添加模型
 */
async function confirmAddModel() {
  await addModelForm.value.validate();
  addModels();
  getSupplierModelList(currentChooseApi.value!.supplierName);
  addSupplierModel.value = false;
  message.success($t("模型添加成功"));
  addModelFormData.value = {
    modelName: "",
    capability: [],
    title: "",
  };
}

/**
 * @description 模型功能下拉值改变
 */
async function capabilityChange(val: string[]) {
  if (val.includes("embedding")) {
    addModelFormData.value.capability = ["embedding"];
    cantChoose.value = true;
  } else {
    addModelFormData.value.capability = val;
    cantChoose.value = false;
  }
}

/**
 * @description 删除模型
 */
async function delModel(modelName: string) {
  const dialog = useDialog({
    title: $t("提示"),
    content: () => $t("是否确定删除当前模型？该操作不可逆"),
    style: {
      width: "400px",
    },
    action: () => (
      <div class="flex justify-center gap-2.5">
        <NButton onClick={dialog.destroy}>{$t("取消")}</NButton>
        <NButton
          type="error"
          onClick={async () => {
            await removeSupplierModel(modelName);
            message.success($t("模型删除成功"));
            getSupplierModelList(currentChooseApi.value!.supplierName);
            dialog.destroy();
          }}>
          确认
        </NButton>
      </div>
    ),
  });
}

/**
 * @description 保存服务商配置
 */
async function saveConfig() {
  if (!applierServiceConfig.value.apiKey || !applierServiceConfig.value.baseUrl) {
    message.error($t("请填写完整配置信息"));
    return;
  }
  await setSupplierConfig();
  message.success($t("配置保存成功"));
  currentChooseApi.value!.status = true;
  getSupplierModelList(currentChooseApi.value!.supplierName);
}

/**
 * @description 检查配置是否正确
 */
async function checkConfig() {
  if (!applierServiceConfig.value.apiKey) {
    message.error($t("缺少API密钥"));
    return;
  } else if (!applierServiceConfig.value.baseUrl) {
    message.error($t("缺少API地址"));
    return;
  }
  const msg = await checkSupplierConfig();
  message.info(msg!);
}

/***
 * @description 获取密钥
 */
async function getKey(url: string) {
  window.open(url);
}

/**
 * @description 模型状态切换
 */
async function modelStatusChange(modelName: string, val: boolean) {
  await setModelStatus(modelName, String(val));
  if (val) {
    message.success($t("模型启用成功"));
  } else {
    message.success($t("模型禁用成功"));
  }
  getSupplierModelList(currentChooseApi.value!.supplierName);
}

/**
 * @description 批量设置模型状态
 */
async function multipleModelStatusChange(val: boolean) {
  const multipleModelNames = supplierModelList.value.map((item) => item.modelName);
  await setModelStatus(multipleModelNames.join(","), String(val));
  if (val) {
    message.success($t("已启用全部模型"));
  } else {
    message.success($t("已禁用全部模型"));
  }
  getSupplierModelList(currentChooseApi.value!.supplierName);
}

/**
 * @description 取消添加模型服务商
 */
async function cancelAddSupplier() {
  addSupplierShow.value = false;
  addSupplierFormData.value = {
    supplierName: "",
    apiKey: "",
    baseUrl: "",
    supplierTitle: "",
  };
}

/**
 * @description 确认添加模型服务商
 */
async function confirmAddSupplier() {
  await addSupplierForm.value.validate();
  await addSupplier();
  message.success($t("添加成功"));
  addSupplierFormData.value = {
    supplierName: "",
    apiKey: "",
    baseUrl: "",
    supplierTitle: "",
  };
  addSupplierShow.value = false;
  getSupplierList();
}

/**
 * @description 删除服务商
 */
async function delSupplier(supplierName: string) {
  const dialog = useDialog({
    title: $t("提示"),
    content: () => $t("是否删除当前服务商? 该操作会同时删除下属所有模型，请谨慎操作！"),
    style: {
      width: "500px",
    },
    action: () => (
      <div class="flex justify-center gap-2.5">
        <NButton onClick={dialog.destroy}>{$t("取消")}</NButton>
        <NButton
          type="error"
          onClick={async () => {
            await removeSupplier(supplierName);
            message.success($t("删除成功"));
            dialog.destroy();
          }}>
          {$t("确认")}
        </NButton>
      </div>
    ),
  });
}

const modelTitTemp = ref("");
/**
 * @desdcription 修改模型标题：取消修改
 */
function cancelEditModelTit() {
  modelTitTemp.value = "";
  currentModelNameForEdiit.value = "";
}

/**
 * @description 修改模型标题
 */
async function confirmEditModelTit() {
  await setModelTitle(modelTitTemp.value);
  message.success($t("修改成功"));
  modelTitTemp.value = "";
  currentModelNameForEdiit.value = "";
}

/**
 * @description 跳转到模型帮助官网
 */
function jumpToHelp(url: string) {
  window.open(url);
}

/**
 * @description 切换供应商状态
 */
function changeCurrentSupplierStatus(supplierName: string, newStatus: boolean) {
  setSupplierStatus(supplierName, newStatus);
}
</script>

<style scoped lang="scss">
@use "@/assets/base";

.api-config-wrapper {
  width: 680px;

  .api-config-content {
    height: 560px;
    display: grid;
    grid-template-columns: 220px 1fr;

    .model-list {
      border-right: 1px solid rgb(221.7, 222.6, 224.4);
      padding-right: 20px;

      .active {
        background-color: var(--bt-list-item-hover);
      }

      .list-item:hover {
        background-color: var(--bt-list-item-hover);
      }
    }

    .config-panel {
      padding-left: 20px;

      .tit {
        font-weight: bold;
        @include base.row-flex-between;
        border-bottom: 1px solid rgb(221.7, 222.6, 224.4);
        padding-bottom: 15px;
      }

      .config-item {
        margin-top: 10px;

        .item-tit {
          margin-bottom: 5px;
        }

        .config-form {
        }
      }

      .config-model-list {
        margin-top: 20px;

        .tit {
          @include base.row-flex-between;
          margin-bottom: 10px;
          padding-right: 20px;
        }

        .model-item {
          @include base.row-flex-between;

          .operation {
            @include base.row-flex-between;
            justify-content: flex-end;
          }
        }

        :deep(.n-list-item) {
          padding-left: 5px;
        }

        .add-model {
          @include base.row-flex-between;
          justify-content: flex-start;
        }
      }
    }
  }
}

@mixin action-wrapper {
  @include base.row-flex-between;
  justify-content: flex-end;
}

.add-model-wrapper {
  width: 480px;

  .action-wrapper {
    @include action-wrapper;
  }
}

.add-supplier-wrapper {
  width: 580px;

  .action-wrapper {
    @include action-wrapper;
  }
}

// :deep(.n-switch .n-switch__unchecked) {
//     padding-left: calc(1* var(--n-rail-height) - var(--n-offset));
//     font-size: 12px;
// }

// :deep(.n-switch .n-switch__checked) {
//     padding-right: calc(1.05* var(--n-rail-height) - var(--n-offset));
//     font-size: 12px;
// }

// :deep(.n-switch .n-switch__button-placeholder) {
//     width: calc(1.15* var(--n-rail-height))
// }

// :deep(.n-switch .n-switch__button-placeholder) {
//     width: calc(1.15* var(--n-rail-height));
// }
</style>
