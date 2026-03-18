<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { dbService } from '@/utils/db';

// ----------------------------------------------------------------------
// 1. DOM Refs
// ----------------------------------------------------------------------
const domRefs = reactive({});

// ----------------------------------------------------------------------
// 2. 页面初始化与全局操作
// ----------------------------------------------------------------------
const isTableLoading = ref(false);

// 初始加载页面数据所需信息
const initPage = async () => {
  try {
    isTableLoading.value = true;
    // 获取表结构
    columns.value = await dbService.getTableSchema();
    
    // 初始化 formData 结构
    columns.value.forEach(col => {
      formData[col.prop] = null;
    });

    await loadData();
  } catch (err) {
    console.error('Page init failed:', err);
    ElMessage.error('获取表结构失败');
  } finally {
    isTableLoading.value = false;
  }
};

// 刷新数据（重新加载 Parquet 文件）
const refreshData = async () => {
  isTableLoading.value = true;
  try {
    ElMessage.info('正在从服务器重新加载文件...');
    await dbService.reloadData();
    currentPage.value = 1;
    await loadData();
    ElMessage.success('数据刷新成功');
  } catch (err) {
    console.error('Refresh data failed:', err);
    ElMessage.error('数据刷新失败');
  } finally {
    isTableLoading.value = false;
  }
};

// 生成并下载 Parquet 数据
const generateData = async () => {
  try {
    ElMessage.info('正在导出数据，请稍候...');
    await dbService.exportCurrentDataToParquet();
    ElMessage.success('导出成功！如果需要永久保存，请将下载的 games.parquet 替换 public/ 目录下的文件。');
  } catch (err) {
    console.error('导出数据失败:', err);
    ElMessage.error('导出失败: ' + err.message);
  }
};

// ----------------------------------------------------------------------
// 3. 表格与分页数据逻辑
// ----------------------------------------------------------------------
const tableData = ref([]);
const columns = ref([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);

// 加载分页数据
const loadData = async () => {
  isTableLoading.value = true;
  try {
    // 1. 获取总数
    const countResult = await dbService.query(`SELECT COUNT(*) as total FROM ${dbService.tableName}`);
    total.value = Number(countResult[0].total);
    
    // 2. 获取分页数据
    const offset = (currentPage.value - 1) * pageSize.value;
    const query = `SELECT rowid as _rowid, * FROM ${dbService.tableName} LIMIT ${pageSize.value} OFFSET ${offset}`;
    
    tableData.value = await dbService.query(query);
  } catch (err) {
    console.error('Load data failed:', err);
    ElMessage.error('数据加载失败');
  } finally {
    isTableLoading.value = false;
  }
};

// 分页处理
const handleCurrentChange = (val) => {
  currentPage.value = val;
  loadData();
};

const handleSizeChange = (val) => {
  pageSize.value = val;
  currentPage.value = 1;
  loadData();
};

// 删除单条记录
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除这条记录吗？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });
    
    await dbService.query(`DELETE FROM ${dbService.tableName} WHERE rowid = ${row._rowid}`);
    ElMessage.success('删除成功');
    loadData();
  } catch (err) {
    if (err !== 'cancel') {
      console.error(err);
      ElMessage.error('删除失败: ' + err.message);
    }
  }
};

// ----------------------------------------------------------------------
// 4. 弹窗与表单逻辑 (新增/编辑)
// ----------------------------------------------------------------------
const dialogVisible = ref(false);
const dialogTitle = ref('');
const dialogType = ref('add'); // 'add' | 'edit'
const formData = reactive({});
const currentEditId = ref(null);

// 打开新增/编辑弹窗
const openDialog = (type, row = null) => {
  dialogType.value = type;
  dialogVisible.value = true;
  dialogTitle.value = type === 'add' ? '新增记录' : '编辑记录';
  
  if (type === 'add') {
    currentEditId.value = null;
    columns.value.forEach(col => formData[col.prop] = null);
  } else {
    currentEditId.value = row._rowid;
    columns.value.forEach(col => formData[col.prop] = row[col.prop]);
  }
};

// 提交表单
const submitForm = async () => {
  try {
    const cols = columns.value.map(c => c.prop);
    const values = cols.map(c => {
      const val = formData[c];
      if (val === null || val === undefined || val === '') return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return val;
    });

    if (dialogType.value === 'add') {
      const sql = `INSERT INTO ${dbService.tableName} (${cols.join(', ')}) VALUES (${values.join(', ')})`;
      await dbService.query(sql);
      ElMessage.success('新增成功');
    } else {
      const setClause = cols.map((c, i) => `${c} = ${values[i]}`).join(', ');
      const sql = `UPDATE ${dbService.tableName} SET ${setClause} WHERE rowid = ${currentEditId.value}`;
      await dbService.query(sql);
      ElMessage.success('更新成功');
    }
    
    dialogVisible.value = false;
    loadData();
  } catch (err) {
    console.error(err);
    ElMessage.error('操作失败: ' + err.message);
  }
};

// ----------------------------------------------------------------------
// 5. Lifecycle
// ----------------------------------------------------------------------
onMounted(() => {
  initPage();
});
</script>

<template>
  <div class="duckdb-demo">
    <div class="header">
      <h1>DuckDB WASM CRUD Demo</h1>
    </div>
    
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button type="primary" icon="Plus" @click="openDialog('add')">
        新增记录
      </el-button>
      <el-button icon="Refresh" @click="refreshData" :loading="isTableLoading">
        刷新数据
      </el-button>
      <el-button type="warning" icon="Download" @click="generateData">
        下载当前数据(Parquet)
      </el-button>
    </div>

    <!-- 数据表格区域：使用 flex:1 占据剩余空间 -->
    <div class="main-content">
      <el-scrollbar>
        <div class="table-wrapper">
          <el-table 
            :data="tableData" 
            border 
            style="width: 100%" 
            stripe
            v-loading="isTableLoading"
          >
            <el-table-column
              v-for="col in columns"
              :key="col.prop"
              :prop="col.prop"
              :label="col.label"
              min-width="150"
              show-overflow-tooltip
              sortable
            />
            
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="scope">
                <el-button size="small" @click="openDialog('edit', scope.row)">编辑</el-button>
                <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-scrollbar>
    </div>
    
    <!-- 分页固定在底部 -->
    <div class="pagination-container">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
    
    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      draggable
      align-center
    >
      <el-scrollbar max-height="60vh">
        <el-form label-position="top" class="dynamic-form" style="padding-right: 10px;">
          <el-form-item 
            v-for="col in columns" 
            :key="col.prop" 
            :label="col.label + ' (' + col.type + ')'"
          >
            <el-input v-model="formData[col.prop]" :placeholder="'请输入 ' + col.label" />
          </el-form-item>
        </el-form>
      </el-scrollbar>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.duckdb-demo {
  padding: 20px;
  max-width: 100%;
  margin: 0 auto;
  height: 100vh; /* 充满屏幕 */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden; /* 防止外层滚动 */
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-shrink: 0; /* 防止头部被压缩 */
}

.toolbar {
  margin-bottom: 16px;
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.main-content {
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 关键：允许 flex item 缩小 */
  border: 1px solid #ebeef5;
  border-radius: 4px;
  /* background: #fff; */
}

.table-wrapper {
  padding: 1px; /* 避免边框重叠 */
}

.pagination-container {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  background: #fff;
  padding: 10px 0;
  flex-shrink: 0;
}
</style>
