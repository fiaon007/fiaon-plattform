import { useState, useEffect } from "react";
import GlassNav from "@/components/GlassNav";

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface TableData {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TableStats {
  table: string;
  rows: number;
  size: string;
}

export default function AdminDatabasePage() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableStructure, setTableStructure] = useState<TableColumn[]>([]);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [dbStats, setDbStats] = useState<TableStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchTables();
    fetchDbStats();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableStructure(selectedTable);
      fetchTableData(selectedTable, page);
    }
  }, [selectedTable, page]);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/database/tables');
      const data = await res.json();
      setTables(data.tables);
    } catch (error) {
      console.error('Error fetching tables:', error);
    }
  };

  const fetchTableStructure = async (tableName: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/database/tables/${tableName}/structure`);
      const data = await res.json();
      setTableStructure(data.columns);
    } catch (error) {
      console.error('Error fetching table structure:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async (tableName: string, pageNum: number = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/database/tables/${tableName}/data?page=${pageNum}&limit=50`);
      const data = await res.json();
      setTableData(data);
    } catch (error) {
      console.error('Error fetching table data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDbStats = async () => {
    try {
      const res = await fetch('/api/database/stats');
      const data = await res.json();
      setDbStats(data.stats);
    } catch (error) {
      console.error('Error fetching database stats:', error);
    }
  };

  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="min-h-screen text-gray-900 antialiased" style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: "linear-gradient(180deg, #f0f4ff 0%, #f8faff 30%, #ffffff 60%)" }}>
      <GlassNav />
      
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold fiaon-gradient-text-animated mb-2">Database Explorer</h1>
          <p className="text-gray-500">View and manage all database tables</p>
        </div>

        {/* Database Statistics */}
        <div className="fiaon-glass-panel rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 fiaon-gradient-text-animated">Database Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {dbStats.map((stat) => (
              <div key={stat.table} className="bg-white/50 rounded-xl p-4 border border-white/40">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{stat.table}</div>
                <div className="text-2xl font-bold fiaon-gradient-text-animated">{stat.rows.toLocaleString()}</div>
                <div className="text-xs text-gray-500">{stat.size}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tables Grid */}
        {!selectedTable && (
          <div className="fiaon-glass-panel rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4 fiaon-gradient-text-animated">All Tables</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tables.map((table) => {
                const stat = dbStats.find(s => s.table === table);
                return (
                  <button
                    key={table}
                    onClick={() => handleTableClick(table)}
                    className="bg-white/50 rounded-xl p-4 border border-white/40 hover:border-blue-300 hover:bg-white/70 transition-all text-left group"
                  >
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{table}</div>
                    <div className="text-lg font-bold fiaon-gradient-text-animated">{stat?.rows.toLocaleString() || '0'}</div>
                    <div className="text-xs text-gray-500">{stat?.size || 'N/A'}</div>
                    <div className="mt-2 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">View Data →</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Table View */}
        {selectedTable && (
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={() => setSelectedTable(null)}
              className="text-sm text-blue-500 hover:text-blue-600 font-medium"
            >
              ← Back to all tables
            </button>

            {/* Table Structure */}
            <div className="fiaon-glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 fiaon-gradient-text-animated">
                Table: {selectedTable}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4">Column</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4">Type</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4">Nullable</th>
                      <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableStructure.map((col) => (
                      <tr key={col.column_name} className="border-b border-gray-100 hover:bg-white/30">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{col.column_name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{col.data_type}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{col.is_nullable}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{col.column_default || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table Data */}
            <div className="fiaon-glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 fiaon-gradient-text-animated">Data</h2>
              {loading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : tableData && tableData.data.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {Object.keys(tableData.data[0]).map((key) => (
                            <th key={key} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-3 px-4">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.data.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-white/30">
                            {Object.values(row).map((value: any, cellIdx) => (
                              <td key={cellIdx} className="py-3 px-4 text-sm text-gray-900">
                                {value === null ? '-' : String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {tableData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-500">
                        Page {tableData.pagination.page} of {tableData.pagination.totalPages} ({tableData.pagination.total} total)
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePageChange(page - 1)}
                          disabled={page === 1}
                          className="px-4 py-2 bg-white/50 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/70 transition-all"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => handlePageChange(page + 1)}
                          disabled={page === tableData.pagination.totalPages}
                          className="px-4 py-2 bg-white/50 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/70 transition-all"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">No data found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
