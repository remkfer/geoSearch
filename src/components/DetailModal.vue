<script setup>
import { ref, defineProps, defineEmits, computed } from "vue";

const props = defineProps({
  result: {  //接收父組件resultList的資料陣列
    type: Array,
    default: ''
  },
  isOpen: {  //接收控制彈窗開關的布林值
    type: Boolean,
    default: 0
  }
});


const emits = defineEmits(['closeDetailModal']);

const closeDetailModal = () => {
  emits('closeDetailModal');
};

// 查看圖片彈窗
const showImg = ref(false);
const imgUrl = ref('');
const imgModal = (url) => {
  imgUrl.value = url;
  showImg.value = !showImg.value;
};
const closeImg = () => {
  showImg.value = false;
};

const isModalOpen = ref(false)
// 點擊圖片外區域關閉圖片彈窗
const closeAllModals = () => {
  isModalOpen.value = false;
  closeImg();
};

// 圖片下載
function downloadFile(url) {
  fetch(url)
    .then(response => response.blob())
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = "report.jpg";
      link.click();
    })
    .catch(error => console.error('下載失敗:', error));
}

//IMPROVE_DATE欄位 日期格式轉換
//原為EXCEL日期 轉為ISO標準日期
function convertDate(date) {
  if (!date || isNaN(date)) return ''; 
    const startDate = new Date(Date.UTC(1900, 0, 1)); //excel基準的起始日期
    const days = date - 2;   //扣除起始日期和閏月的2/29
    const resultDate = new Date(startDate.getTime() + days * 86400000); 
    console.log(resultDate.toISOString().split('T')[0])
    return resultDate.toISOString().split('T')[0];  
    //EX.原日期格式為2022-05-24T00:00:00.000Z 取到T之前的數值 變2022-05-24
}

const labels = {
  items: '項次',
  pipe_code: '孔洞代碼',
  dis: '行政區',
  roadname: '路名',
  lat: '緯度',
  lng: '經度',
  AREA: '孔洞位置(M)',
  length: '孔洞長度(M)',
  width: '孔洞寬度(M)',
  DTYPE: '危險程度',
  DT_CREATE: '檢測日期',
  DT_RECORD: '提送日期',
  IS_IMPROVE: '是否已改善',
  Damaged_Reason: '破損原因',
  IMPROVE_DATE: '改善日期',
  first_manage: '初判權責單位',
  manage: '維管科室',
}

const filteredDetails = computed(() => {
  return props.result.map(item => {  //將api返回資料逐一檢查
    const details = [];  //建立空陣列，放入不回空值的欄位資料
    let fileUrl = item.File_url; //特別處理圖片資料
    Object.keys(item).forEach(key => {
      let value = item[key]
      if (value && labels[key]) { 
        if (key === 'IMPROVE_DATE') {  //若label為improve_date則將其值傳至convertDate函式內做處理
          value = convertDate(value); 
        }
        //若欄位資料為空不加入details內
        if (!value) return;
        
        details.push({
          label: labels[key],
          value: value,
        });
      }
    });
    return {details, fileUrl};
  });
});

</script>

<template>
    <div class="detail" v-for= "(item, index ) in filteredDetails" :key="index" v-if="isOpen">
      <div class="detailModal" >
        <table>
          <caption>
            <p>詳細資料</p>
            <span @click="closeDetailModal">X</span>
          </caption>
          <tr v-for="detail in item.details" :key="detail.label">
            <th>{{ detail.label }} </th>
            <td>{{ detail.value }}</td>
          </tr>
          <tr>
            <th>調查報告</th>
            <td>
              <a @click="imgModal(item.fileUrl)">查看</a> 
              <a class="download" @click="downloadFile(item.fileUrl)">下載</a>
            </td>
          </tr>
        </table>
      </div>
      <div class="modalCover" v-show="showImg" @click="closeAllModals" @touchmove.prevent>
        <div class="showImg">
          <img v-show="showImg" :src="imgUrl" alt="調查報告圖 路面下空洞調查車記錄圖" >
        </div>
      </div>
    </div>
</template>

<style lang="scss" scoped>
    @import 'src/assets/scss/var/font';
    @import 'src/assets/scss/component/detailModal';
</style>