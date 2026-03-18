import * as duckdb from '@duckdb/duckdb-wasm';

class DuckDBService {
  constructor() {
    this.db = null;
    this.conn = null;
    this.worker = null;
    this.isReady = false;
    this.initPromise = null;
    this.tableName = 'demo_table';
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

  // 内部方法：初始化默认表
  async _initDefaultTable() {
    const parquetUrl = new URL(`${import.meta.env.BASE_URL}sample.parquet`, window.location.origin).href;
    console.log('Loading default Parquet:', parquetUrl);
    
    await this.registerFile('sample.parquet', parquetUrl);
    await this.query(`CREATE OR REPLACE TABLE ${this.tableName} AS SELECT * FROM 'sample.parquet'`);
  }

  // 获取表结构
  async getTableSchema() {
    if (!this.isReady) throw new Error('DuckDB not initialized');
    const rows = await this.query(`DESCRIBE ${this.tableName}`);
    return rows.map(r => ({ prop: r.column_name, label: r.column_name, type: r.column_type }));
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
