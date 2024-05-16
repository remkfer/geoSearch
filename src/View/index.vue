<script setup>
import { onMounted, ref } from "vue";
import.meta.env.VITE_API_URL
import axios from 'axios';
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import DatePicker from 'vue-datepicker-next';
import 'vue-datepicker-next/locale/zh-cn';
import 'vue-datepicker-next/index.css';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { CaretBottom } from '@element-plus/icons-vue';
import SelectArea from "../components/SelectArea.vue";


let map;
let markerLayerGroup;  //管理marker的圖層
let lineLayerGroup;   //管理polyline的圖層

const mapContainer = ref(null);  //放置地圖的container

//預設之marker
const mapIcon = L.icon({
  iconUrl: '/src/assets/img/pin.png',
  iconSize: [43, 45],
  iconAnchor: [21.5, 45],
});

//點擊後的紅色marker
const redIcon = L.icon({
  iconUrl: '/src/assets/img/pinR.png',
  iconSize: [43, 45],
  iconAnchor: [21.5, 45]
});

onMounted(() => {
  // 建立map
  map = L.map(mapContainer.value, {
    center: [22.676617, 120.306563],
    zoom: 20,
    zoomControl: false, 
    scrollWheelZoom: true, 
    smoothWheelZoom: true,  
    smoothZoom: true,
    smoothZoomDelay: 300
  });
  
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {}).addTo(map);
  markerLayerGroup = L.layerGroup().addTo(map)  //建立管理marker的圖層
  lineLayerGroup = L.layerGroup().addTo(map)  //建立管理polyline的圖層
});  

// 嚴重程度列表
const levelOptions = ref([]); //放置所有的嚴重程度選項
const selectedLevels = ref([]);  //放置已選擇的level選項 用於select的v-model

axios.get(`${import.meta.env.VITE_API_URL}/getLevel`)
.then(res => {
  levelOptions.value = res.data.data.level;
})
.catch(error => {
  console.log('請求錯誤', error);
}
);

// 行政區列表
const districtOptions = ref([]);  //放置所有的行政區選項
const selectedDistrict = ref('');  //放置已選擇的行政區選項 用於select的v-model

axios.get(`${import.meta.env.VITE_API_URL}/getDis`)
  .then((res) => {
    districtOptions.value = res.data.data.dis;  
  })
  .catch(error => {
    console.log('請求錯誤', error);
  }
);


// 接收datepicker的值
const date = ref([]);


// 查詢結果 多筆
const resultList = ref([]); //放置篩選過後的結果
const allResults = ref([]); //查詢條件為空值時則顯示所有結果
const markersMap = ref({}); 
let currentRedMarker = null;  //為判斷是否有marker被點擊


const fetchData = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_API_URL}/search_SP_List`, {
      page: currentPage.value,
      dis: selectedDistrict.value || '',
      dtype: selectedLevels.value || '',
      dts: date.value[0] ,
      dte: date.value[1] ,
    });

    //清除前次查詢的marker
    markerLayerGroup.clearLayers();

    resultList.value = response.data.data.data;
    allResults.value = response.data.data.data;
    totalPage.value = response.data.data.total_page;

    resultList.value.forEach(item => {
      const coordinates = [parseFloat(item.LAT), parseFloat(item.LNG)];  //轉換經緯度格式
      const marker = L.marker(coordinates, { icon: mapIcon }).addTo(map); 
      marker.on('click', () => { //建立click事件 
        fetchSingle(item.ID, item.DTYPE);
        if (currentRedMarker) {  //若已有變色的marker則再次點擊變回初始marker
          currentRedMarker.setIcon(mapIcon);
        }
          marker.setIcon(redIcon); //若點擊marker則marker變色
          currentRedMarker = marker;
          map.setView(coordinates, map.getZoom(), { animate: true });
      });

      //以下兩個v-on則為解決marker之間距離太近而難以點擊到下方marker的問題
      marker.on('mouseover', function() {
        this.setZIndexOffset(999);  
      });
      marker.on('mouseout', function() {
        this.setZIndexOffset(99);
      });

      markerLayerGroup.addLayer(marker); //將marker放進markerLayerGroup
      markersMap.value[item.ID] = marker  

    });

    if (resultList.value.length > 0) {
      const firstCoord = [parseFloat(resultList.value[0].LAT), parseFloat(resultList.value[0].LNG)];
      map.setView(firstCoord, map.getZoom(), { animate: true });
    }
  }catch (error) {
    console.error('錯誤請求', error);
  }
};


// 查詢資料 單筆
const resultSingle = ref([]);
const selectedItemId = ref(null);
const fetchSingle = (ID, DTYPE) => {
  selectedItemId.value = ID;
  if (currentRedMarker) {
    currentRedMarker.setIcon(mapIcon);  
    currentRedMarker.setZIndexOffset(0)
  }

  const marker = markersMap.value[ID];
  if (marker) {
    marker.setIcon(redIcon);  
    currentRedMarker = marker;  
    marker.setZIndexOffset(9999)
    map.setView(marker.getLatLng(), map.getZoom());
  }

  axios.post(`${import.meta.env.VITE_API_URL}/get_SP_detail`,{
    ID: parseInt(ID),
    DTYPE: DTYPE
  })
    .then(res => {
      resultSingle.value = res.data.data;
      openDetailModal();
    }).catch(error => {
      console.log('請求錯誤', error);
    }
  );
}


//查詢巡查範圍
const traceData = ref([]);
const fetchTrace = async () => {
  try {
    const response = await axios.post(`${import.meta.env.VITE_API_URL}/search_TRACE_List`, {
      dis: traceData.value,  
      dts: date.value[0], 
      dte: date.value[1] 
    });

    //處理經緯度格式
    const polylines = response.data.data.data.map(item => {
      const coordinates = item.pol.replace('LINESTRING (', '').replace(')', '').split(', ').map(coord => {
        const [lng, lat] = coord.split(' ');
        return [parseFloat(lat), parseFloat(lng)];
      });
      return coordinates;
    });

    //清除舊Polyline
    if (map._layers) {
      for (var i in map._layers) {
        if (map._layers[i]._path !== undefined) {
          map.removeLayer(map._layers[i]);
        }
      }
    }

    //繪製Polyline
    if(polylines.length > 0){
      polylines.forEach(line => {
        const polyline = L.polyline(line, { color: 'red', weight: 12 }).addTo(map);
        map.fitBounds(polyline.getBounds());
        lineLayerGroup.addLayer(polyline); //將polyline加入lineLayerGroup
      });
    } else{
      Swal.fire({
        title: "查無資料",
        text: "請重新選擇篩選條件",
        color: "#000",
        confirmButtonColor: "#02318E"
      });
    }
  } catch (error) {
    console.error('請求錯誤', error);
  }
};


// tab切換
const switchIndex = ref(0);
function switchTab(index) {
  switchIndex.value = index;
  markerLayerGroup.clearLayers(); //切換tab時則關閉/清空查詢後顯示的資料
  lineLayerGroup.clearLayers();
  closeDetailModal();
}

// 查詢結果彈窗
const isModalOpen = ref(false)
const toggleModal = async () => {
  await fetchData();
  if (resultList.value && resultList.value.length > 0) {
    isModalOpen.value = true; 
  } else {
    Swal.fire({
      title: "查無資料",
      text: "請重新選擇篩選條件",
      color: "#000",
      confirmButtonColor: "#02318E"
    });
  }
};

const closeModal = () =>{
  currentPage.value = 1; 
  //避免重新查詢時抓不到資料而無法顯示查詢結果彈窗、及從上次查看的頁碼開始顯示結果
  isModalOpen.value = false;
}

// 單筆詳細資料彈窗
const detailModal = ref(false);
const openDetailModal= () => {
  detailModal.value = true
};

const closeDetailModal = () => {
  detailModal.value = false;
}


// 頁碼
const currentPage = ref(1); //當前頁碼
const pageSize = ref(15);   //一頁最多顯示幾筆資料
const totalPage = ref(0)  //總共的頁數

// 頁碼切換
const handleCurrentChange = (newPage) => {
  currentPage.value = newPage;
  fetchData()
};

</script>

<template>
  <div class="container">
    <div class="header">
      <Header></Header>
    </div>
    
    <div class="map" ref="mapContainer"></div>
  
    <div class="selection">
      <div class="search">
        <div class="searchArea">
          <span :class="{ 'active': switchIndex == 0 }" @click="switchTab(0)">地下孔洞查詢</span>
          <span :class="{ 'active': switchIndex == 1 }" @click="switchTab(1)">巡查範圍查詢</span>
        </div>
        <div class="searchContent">
          <div class="tab1" v-if="switchIndex == 0">
            <div class="district">
              <div class="districtSelect">
                <SelectArea label="行政區">
                  <el-select 
                    v-model="selectedDistrict" 
                    placeholder="請選擇行政區" 
                    size="large"
                    style="width: 14.7vw"
                    :suffix-icon = 'CaretBottom'
                  >
                    <el-option
                      v-for="district in districtOptions"
                      :key="district.id"
                      :label="district.name"
                      :value="district"
                     
                    />
                  </el-select>
                </SelectArea>
              </div>
            </div>

            <div class="time">
              <div class="datePicker">
                <SelectArea label="巡查時間">
                  <section>
                      <date-picker
                          v-model:value="date"
                          value-type="format" 
                          format="YYYY-MM-DD"
                          :default-value="[new Date('2022-01-01'), new Date('2022-12-31')]"
                          type="date"
                          range
                          clearable
                          placeholder="請選擇日期區間"
                          >
                          <template v-slot:icon-calendar>
                              <CaretBottom style="width: 14px; color:#A8ABB2" />
                          </template>
                      </date-picker>
                  </section> 
                </SelectArea>
              </div> 
            </div>

            <div class="level">
              <div class="levelSelect">
                <SelectArea label="嚴重程度">
                  <el-select
                    v-model="selectedLevels"
                    size="large"
                    multiple
                    placeholder="請選擇嚴重程度"
                    style="width: 14.7vw"
                    :suffix-icon = 'CaretBottom'
                    filterable
                  >
                    <el-option
                      v-for="level in levelOptions"
                      :key="level.id"
                      :label="level"
                      :value="level"
                    />
                  </el-select> 
                </SelectArea>
              </div>
            </div>

            <div class="searchBtn">
            <input type="submit" value="查詢" @click="toggleModal">
          </div>
          </div>
  
          <div class="tab2" v-else>
            <div class="district">
              <div class="districtSelect">
                <SelectArea label="行政區">
                  <el-select
                    v-model="traceData"
                    placeholder="請選擇行政區"
                    size="large"
                    style="width: 14.7vw"
                    clearable
                    :suffix-icon="CaretBottom"
                    filterable
                  >
                    <el-option
                      v-for="district in districtOptions"
                      :key="district.id"
                      :label="district"  
                      :value="district"
                    />
                  </el-select>
                </SelectArea>
              </div>
            </div>

            <div class="time">
              <div class="datePicker">
                <SelectArea label="巡查時間">
                  <section>
                      <date-picker
                          v-model:value="date"
                          value-type="format" 
                          format="YYYY-MM-DD"
                          :default-value="[new Date('2022-01-01'), new Date('2022-12-31')]"
                          type="date"
                          range
                          clearable
                          placeholder="請選擇日期區間"
                          >
                          <template v-slot:icon-calendar>
                              <CaretBottom style="width: 14px; color:#A8ABB2" />
                          </template>
                      </date-picker>
                  </section>
                </SelectArea>
              </div> 
            </div>
            <div class="searchBtn">
              <input type="submit" value="查詢" @click="fetchTrace">
            </div>
          </div>
        </div>
      </div>
      <div class="resultList" v-show="isModalOpen">
        <div class="title">
          <img @click="closeModal" src="/src/assets/img/left-solid.svg" alt="">
          <h2>查詢結果</h2>
        </div>
        <div class="listTitle" >
          <table >
            <tr>
              <th></th>
              <th></th>
              <th>孔洞代碼</th>
              <th>嚴重程度</th>
              <th>巡查時間</th>
            </tr>
            <tr v-for="(list, index) in resultList" @click="fetchSingle(list.ID, list.DTYPE)" :class="{ 'selected-item': list.ID === selectedItemId }">
              <td> {{ index + 1 + '.' }} </td>
              <td> {{ list.dis }} </td>
              <td> {{ list.pipe_code }}</td>
              <td :class="{ 'highlight': list.DTYPE.includes('S') }"> {{ list.DTYPE }}級</td>
              <td> {{ list.DT_CREATE }}</td>
            </tr>
          </table>
        </div>
        
        <div class="pagination">
          <el-pagination
              small
              layout = "prev, pager, next"
              :hide-on-single-page = true
              :page-size = "pageSize"
              :current-page = "currentPage"
              :total = "totalPage * pageSize"
              @current-change = "handleCurrentChange"
          />
        </div>
      </div>
    </div>

    <div class="detail">
      <DetailModal 
        :result="resultSingle" 
        :isOpen="detailModal" 
        @closeDetailModal="closeDetailModal" 
      />
    </div> 
  </div>
</template>

<style lang="scss">
  @import '../assets/scss/page/index.scss';
</style>