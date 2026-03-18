import * as duckdb from '@duckdb/duckdb-wasm';

class DuckDBService {
  constructor() {
    this.db = null;
    this.conn = null;
    this.worker = null;
    this.isReady = false;
    this.initPromise = null;
    this.tableName = 'games_table';
  }

  // 初始化单例
  async init() {
    if (this.isReady) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

        const workerUrl = URL.createObjectURL(
          new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
        );
        this.worker = new Worker(workerUrl);

        const logger = new duckdb.ConsoleLogger();
        this.db = new duckdb.AsyncDuckDB(logger, this.worker);
        await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        this.conn = await this.db.connect();
        
        // 默认注册文件并初始化表
        await this._initDefaultTable();

        this.isReady = true;
        URL.revokeObjectURL(workerUrl);
        console.log('DuckDB initialized successfully');
      } catch (err) {
        console.error('DuckDB init failed:', err);
        this.isReady = false;
        throw err;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  // 重新从服务器加载 Parquet 文件
  async reloadData() {
    if (!this.isReady) throw new Error('DuckDB not initialized');
    await this.query(`DROP TABLE IF EXISTS ${this.tableName}`);
    await this._initDefaultTable();
  }

  // 内部方法：初始化默认表
  async _initDefaultTable() {
    // import.meta.env.BASE_URL 在 Vite 中由 base 配置决定（如 '/houhouhou/'）
    // 为了确保在 GitHub Pages 和本地都能正确拼接绝对路径，使用如下逻辑：
    const basePath = import.meta.env.BASE_URL.endsWith('/') 
      ? import.meta.env.BASE_URL 
      : `${import.meta.env.BASE_URL}/`;
      
    const parquetUrl = new URL(`${basePath}games.parquet`, window.location.origin).href;
    console.log('Loading default Parquet:', parquetUrl);
    
    try {
      await this.registerFile('games.parquet', parquetUrl);
      await this.query(`CREATE OR REPLACE TABLE ${this.tableName} AS SELECT * FROM 'games.parquet'`);
    } catch (err) {
      console.warn('Failed to load games.parquet, maybe it does not exist yet.', err);
      // 如果文件不存在，创建一个空表，防止后续查询报错
      await this.query(`
        CREATE OR REPLACE TABLE ${this.tableName} (
          name_cn VARCHAR,
          name_jp VARCHAR,
          name_en VARCHAR,
          cover_url VARCHAR,
          description VARCHAR,
          tags VARCHAR,
          release_date DATE,
          upload_time TIMESTAMP,
          developer VARCHAR,
          publisher VARCHAR,
          cloud_disk_url VARCHAR
        )
      `);
    }
  }

  // 获取表结构
  async getTableSchema() {
    if (!this.isReady) throw new Error('DuckDB not initialized');
    const rows = await this.query(`DESCRIBE ${this.tableName}`);
    return rows.map(r => ({ prop: r.column_name, label: r.column_name, type: r.column_type }));
  }

  // 导出当前表数据为 Parquet 文件并触发下载
  async exportCurrentDataToParquet() {
    if (!this.isReady) throw new Error('DuckDB not initialized');
    
    const fileName = 'exported_games.parquet';
    
    // 使用 COPY 语句将当前表数据导出到虚拟文件系统
    // 注意：这里不需要导出内部的 rowid，所以显式选择所需列（或者直接 SELECT * 如果不包含 rowid）
    await this.query(`COPY (SELECT * FROM ${this.tableName}) TO '${fileName}' (FORMAT PARQUET)`);

    // 将文件数据拷贝为 Uint8Array
    const buffer = await this.db.copyFileToBuffer(fileName);

    // 创建 Blob 并触发下载
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'games.parquet'; // 用户下载后看到的文件名
    document.body.appendChild(a);
    a.click();
    
    // 清理资源
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 注册远程文件
  async registerFile(fileName, url) {
    if (!this.db) throw new Error('DuckDB not initialized');
    await this.db.registerFileURL(fileName, url, duckdb.DuckDBDataProtocol.HTTP, false);
  }

  // 执行查询
  async query(sql) {
    if (!this.conn) throw new Error('DuckDB connection not established');
    const result = await this.conn.query(sql);
    // 转换结果为普通数组
    return result.toArray().map(r => r.toJSON());
  }

  // 关闭连接
  async close() {
    if (this.conn) await this.conn.close();
    if (this.db) await this.db.terminate();
    if (this.worker) this.worker.terminate();
    this.isReady = false;
    this.conn = null;
    this.db = null;
    this.worker = null;
  }
}

// 导出单例
export const dbService = new DuckDBService();
