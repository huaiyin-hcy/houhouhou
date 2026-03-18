<script setup>
import { reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { dbService } from '@/utils/db';

// ----------------------------------------------------------------------
// 1. DOM Refs & State
// ----------------------------------------------------------------------
const refs = reactive({});
const state = reactive({
  isTableLoading: false,
  tableData: [],
  columns: [],
  total: 0,
  currentPage: 1,
  pageSize: 10,
  
  // Dialog State
  dialogVisible: false,
  dialogTitle: '',
  dialogType: 'add',
  formData: {},
  currentEditId: null
});

// ----------------------------------------------------------------------
// 2. Methods
// ----------------------------------------------------------------------

// 初始加载页面数据所需信息（由于 App.vue 已经确保了 dbService 初始化完毕）
const initPage = async () => {
  try {
    state.isTableLoading = true;
    // 获取表结构
    state.columns = await dbService.getTableSchema();
    
    // 初始化 formData 结构
    state.columns.forEach(col => {
      state.formData[col.prop] = null;
    });

    await loadData();
  } catch (err) {
    console.error('Page init failed:', err);
    ElMessage.error('获取表结构失败');
  } finally {
    state.isTableLoading = false;
  }
};

// 加载分页数据
const loadData = async () => {
  state.isTableLoading = true;
  try {
    // 1. 获取总数
    const countResult = await dbService.query(`SELECT COUNT(*) as total FROM ${dbService.tableName}`);
    state.total = Number(countResult[0].total);
    
    // 2. 获取分页数据
    const offset = (state.currentPage - 1) * state.pageSize;
    const query = `SELECT rowid as _rowid, * FROM ${dbService.tableName} LIMIT ${state.pageSize} OFFSET ${offset}`;
    
    state.tableData = await dbService.query(query);
  } catch (err) {
    console.error('Load data failed:', err);
    ElMessage.error('数据加载失败');
  } finally {
    state.isTableLoading = false;
  }
};

// 分页处理
const handleCurrentChange = (val) => {
  state.currentPage = val;
  loadData();
};

const handleSizeChange = (val) => {
  state.pageSize = val;
  state.currentPage = 1;
  loadData();
};

// 删除
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

// 打开新增/编辑弹窗
const openDialog = (type, row = null) => {
  state.dialogType = type;
  state.dialogVisible = true;
  state.dialogTitle = type === 'add' ? '新增记录' : '编辑记录';
  
  if (type === 'add') {
    state.currentEditId = null;
    state.columns.forEach(col => state.formData[col.prop] = null);
  } else {
    state.currentEditId = row._rowid;
    state.columns.forEach(col => state.formData[col.prop] = row[col.prop]);
  }
};

// 提交表单
const submitForm = async () => {
  try {
    const cols = state.columns.map(c => c.prop);
    const values = cols.map(c => {
      const val = state.formData[c];
      if (val === null || val === undefined || val === '') return 'NULL';
      if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
      return val;
    });

    if (state.dialogType === 'add') {
      const sql = `INSERT INTO ${dbService.tableName} (${cols.join(', ')}) VALUES (${values.join(', ')})`;
      await dbService.query(sql);
      ElMessage.success('新增成功');
    } else {
      const setClause = cols.map((c, i) => `${c} = ${values[i]}`).join(', ');
      const sql = `UPDATE ${dbService.tableName} SET ${setClause} WHERE rowid = ${state.currentEditId}`;
      await dbService.query(sql);
      ElMessage.success('更新成功');
    }
    
    state.dialogVisible = false;
    loadData();
  } catch (err) {
    console.error(err);
    ElMessage.error('操作失败: ' + err.message);
  }
};

// ----------------------------------------------------------------------
// 3. Lifecycle
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
      <el-button icon="Refresh" @click="loadData" :loading="state.isTableLoading">
        刷新数据
      </el-button>
    </div>

    <!-- 数据表格区域：使用 flex:1 占据剩余空间 -->
    <div class="main-content">
      <!-- 
        使用 el-scrollbar 包裹整个内容区 
        注意：如果数据量非常大，建议 el-table 自己处理滚动 (height="100%")
        如果一定要 el-scrollbar，则 el-table 不设高度，让其撑开
      -->
      <el-scrollbar>
        <div class="table-wrapper">
          <el-table 
            :data="state.tableData" 
            border 
            style="width: 100%" 
            stripe
          >
            <el-table-column
              v-for="col in state.columns"
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
        v-model:current-page="state.currentPage"
        v-model:page-size="state.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        :total="state.total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
    
    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="state.dialogVisible"
      :title="state.dialogTitle"
      width="600px"
      draggable
      align-center
    >
      <el-scrollbar max-height="60vh">
        <el-form label-position="top" class="dynamic-form" style="padding-right: 10px;">
          <el-form-item 
            v-for="col in state.columns" 
            :key="col.prop" 
            :label="col.label + ' (' + col.type + ')'"
          >
            <el-input v-model="state.formData[col.prop]" :placeholder="'请输入 ' + col.label" />
          </el-form-item>
        </el-form>
      </el-scrollbar>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="state.dialogVisible = false">取消</el-button>
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
