import { useState, useEffect } from "react";

interface TableStats {
  table: string;
  rows: number;
}

interface AllTableData {
  [key: string]: any[];
}

export default function AdminDatabasePage() {
  const [dbStats, setDbStats] = useState<TableStats[]>([]);
  const [allData, setAllData] = useState<AllTableData>({});
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats
      const statsRes = await fetch('/api/database/stats');
      const statsData = await statsRes.json();
      setDbStats(statsData.stats);
      
      // Fetch data for all tables (first page only)
      const dataPromises = statsData.stats.map(async (stat: TableStats) => {
        try {
          const dataRes = await fetch(`/api/database/tables/${stat.table}/data?page=1&limit=10`);
          const data = await dataRes.json();
          return { table: stat.table, data: data.data };
        } catch (error) {
          console.error(`Error fetching data for ${stat.table}:`, error);
          return { table: stat.table, data: [] };
        }
      });
      
      const results = await Promise.all(dataPromises);
      const dataMap: AllTableData = {};
      results.forEach(({ table, data }) => {
        dataMap[table] = data;
      });
      setAllData(dataMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName);
  };

  const handleBack = () => {
    setSelectedTable(null);
  };

  const tablesPerPage = 4;
  const totalPages = Math.ceil(dbStats.length / tablesPerPage);
  const currentTables = dbStats.slice(currentPage * tablesPerPage, (currentPage + 1) * tablesPerPage);

  return (
    <div className="min-h-screen flex text-gray-900 antialiased" style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: "linear-gradient(180deg, #0a1628 0%, #1a3560 50%, #0a1628 100%)" }}>
      {/* Left Sidebar */}
      <div className="w-64 bg-white/5 border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold text-white mb-1">Database</h1>
          <p className="text-xs text-gray-400">Admin Explorer</p>
        </div>
        
        <nav className="flex-1 p-4">
          <button
            onClick={handleBack}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
              !selectedTable 
                ? 'bg-blue-500/20 text-white border border-blue-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="font-medium">START</span>
            </div>
          </button>
          
          {dbStats.map((stat) => (
            <button
              key={stat.table}
              onClick={() => handleTableClick(stat.table)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all mt-2 ${
                selectedTable === stat.table
                  ? 'bg-blue-500/20 text-white border border-blue-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                <span className="font-medium truncate">{stat.table}</span>
              </div>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-gray-500">
            {dbStats.length} Tables
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-white text-lg">Loading...</div>
          </div>
        ) : !selectedTable ? (
          <div className="p-8">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Database Overview</h2>
              <p className="text-gray-400">All tables and their data sorted by row count</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
              {dbStats.map((stat) => (
                <div
                  key={stat.table}
                  onClick={() => handleTableClick(stat.table)}
                  className="fiaon-glass-panel rounded-2xl p-6 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all cursor-pointer"
                >
                  <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">{stat.table}</div>
                  <div className="text-3xl font-bold text-white mb-1">{stat.rows.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">{stat.rows.toLocaleString()} rows</div>
                </div>
              ))}
            </div>

            {/* All Data Tables */}
            <div className="space-y-8">
              {currentTables.map((stat) => (
                <div key={stat.table} className="fiaon-glass-panel rounded-2xl p-6 border border-white/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{stat.table}</h3>
                    <button
                      onClick={() => handleTableClick(stat.table)}
                      className="text-sm text-blue-400 hover:text-blue-300 font-medium"
                    >
                      View All →
                    </button>
                  </div>
                  
                  {allData[stat.table] && allData[stat.table].length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            {Object.keys(allData[stat.table][0]).map((key) => (
                              <th key={key} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allData[stat.table].map((row, idx) => (
                            <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                              {Object.values(row).map((value: any, cellIdx) => (
                                <td key={cellIdx} className="py-2 px-3 text-sm text-gray-300">
                                  {value === null ? '-' : String(value).substring(0, 50)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-sm">No data</div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-all"
                >
                  Previous
                </button>
                <span className="text-gray-400 text-sm">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8">
            {/* Table Detail View */}
            <div className="mb-6">
              <button
                onClick={handleBack}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium mb-4"
              >
                ← Back to overview
              </button>
              <h2 className="text-3xl font-bold text-white mb-2">{selectedTable}</h2>
              <p className="text-gray-400">
                {dbStats.find(s => s.table === selectedTable)?.rows.toLocaleString()} rows total
              </p>
            </div>

            <div className="fiaon-glass-panel rounded-2xl p-6 border border-white/10">
              <TableDetailView tableName={selectedTable} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TableDetailView({ tableName }: { tableName: string }) {
  const [data, setData] = useState<any[]>([]);
  const [structure, setStructure] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData(page);
    fetchStructure();
  }, [tableName, page]);

  const fetchData = async (pageNum: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/database/tables/${tableName}/data?page=${pageNum}&limit=50`);
      const result = await res.json();
      setData(result.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStructure = async () => {
    try {
      const res = await fetch(`/api/database/tables/${tableName}/structure`);
      const result = await res.json();
      setStructure(result.columns);
    } catch (error) {
      console.error('Error fetching structure:', error);
    }
  };

  if (loading && data.length === 0) {
    return <div className="text-white text-center py-8">Loading...</div>;
  }

  return (
    <>
      {/* Table Structure */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-white mb-4">Table Structure</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">Column</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">Type</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">Nullable</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">Default</th>
              </tr>
            </thead>
            <tbody>
              {structure.map((col: any) => (
                <tr key={col.column_name} className="border-b border-white/5">
                  <td className="py-2 px-3 text-sm text-white">{col.column_name}</td>
                  <td className="py-2 px-3 text-sm text-gray-400">{col.data_type}</td>
                  <td className="py-2 px-3 text-sm text-gray-400">{col.is_nullable}</td>
                  <td className="py-2 px-3 text-sm text-gray-400">{col.column_default || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table Data */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Data</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/20 transition-all"
            >
              Previous
            </button>
            <span className="text-gray-400 text-sm py-2">Page {page}</span>
            <button
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm font-medium hover:bg-white/20 transition-all"
            >
              Next
            </button>
          </div>
        </div>
        
        {data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {Object.keys(data[0]).map((key) => (
                    <th key={key} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 px-3">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, idx) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                    {Object.values(row).map((value: any, cellIdx) => (
                      <td key={cellIdx} className="py-2 px-3 text-sm text-gray-300">
                        {value === null ? '-' : String(value).substring(0, 100)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">No data found</div>
        )}
      </div>
    </>
  );
}
