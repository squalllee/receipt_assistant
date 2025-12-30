
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Camera,
  Upload,
  Trash2,
  Plus,
  Calculator,
  Users,
  Loader2,
  AlertCircle,
  FileText,
  History,
  CheckCircle,
  CalendarDays,
  X,
  TrendingUp,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import { ReceiptItem, Payer, CalculationResult, SettlementRecord } from './types';
import { analyzeReceipt } from './ollamaService';
import { saveSettlementToSupabase, fetchHistoryFromSupabase, deleteHistoryFromSupabase } from './supabase';

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // State initialization with localStorage
  const [drafts, setDrafts] = useState<Record<string, ReceiptItem[]>>(() => {
    const saved = localStorage.getItem('huan_yan_drafts');
    return saved ? JSON.parse(saved) : {};
  });

  const items = drafts[selectedDate] || [];
  const setItems = (newItemsOrUpdater: ReceiptItem[] | ((prev: ReceiptItem[]) => ReceiptItem[])) => {
    setDrafts(prev => {
      const currentDraft = prev[selectedDate] || [];
      const updatedItems = typeof newItemsOrUpdater === 'function'
        ? newItemsOrUpdater(currentDraft)
        : newItemsOrUpdater;
      return { ...prev, [selectedDate]: updatedItems };
    });
  };

  const [history, setHistory] = useState<SettlementRecord[]>(() => {
    const saved = localStorage.getItem('huan_yan_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'register' | 'inquiry'>('register');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('huan_yan_drafts', JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    localStorage.setItem('huan_yan_history', JSON.stringify(history));
  }, [history]);

  // Sync with Supabase on mount
  useEffect(() => {
    const syncHistory = async () => {
      try {
        const dbHistory = await fetchHistoryFromSupabase();
        setHistory(dbHistory);
      } catch (err) {
        console.error("Failed to sync history from Supabase:", err);
      }
    };
    syncHistory();
  }, []);

  // Derive current display data based on selection
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const selectedHistoryRecords = useMemo(() =>
    history.filter(h => h.date.startsWith(selectedDate.substring(0, 7))),
    [history, selectedDate]);

  const displayItems = activeTab === 'inquiry'
    ? [] // Not used directly items list anymore in inquiry
    : items;

  const totals = useMemo((): CalculationResult => {
    let huanTotal = 0;
    let yanTotal = 0;
    let total = 0;

    displayItems.forEach(item => {
      total += item.amount;
      if (item.payer === '桓') {
        huanTotal += item.amount;
      } else if (item.payer === '妍') {
        yanTotal += item.amount;
      } else {
        const huanPart = Math.ceil(item.amount / 2);
        const yanPart = Math.floor(item.amount / 2);
        huanTotal += huanPart;
        yanTotal += yanPart;
      }
    });

    return { huanTotal, yanTotal, total };
  }, [displayItems]);

  const monthlyTotals = useMemo((): CalculationResult => {
    const [year, month] = selectedDate.split('-');
    const monthPrefix = `${year}-${month}`;

    const monthRecords = history.filter(h => h.date.startsWith(monthPrefix));

    return monthRecords.reduce((acc, curr) => ({
      huanTotal: acc.huanTotal + curr.huanTotal,
      yanTotal: acc.yanTotal + curr.yanTotal,
      total: acc.total + curr.grandTotal
    }), { huanTotal: 0, yanTotal: 0, total: 0 });
  }, [history, selectedDate]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsAnalyzing(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setPreviewImage(base64);

      try {
        const extractedItems = await analyzeReceipt(base64);
        const newItems: ReceiptItem[] = extractedItems.map(item => ({
          id: crypto.randomUUID(),
          name: item.name,
          amount: item.amount,
          payer: '桓'
        }));
        setItems(prev => [...prev, ...newItems]);
      } catch (err: any) {
        setError(err.message || "發生錯誤");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Removed addItem as requested

  const updateItem = (id: string, updates: Partial<ReceiptItem>) => {
    if (isHistoryMode) return;
    setItems(items.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    if (isHistoryMode) return;
    setItems(items.filter(item => item.id !== id));
  };

  const clearItems = () => {
    if (items.length === 0) return;
    if (confirm("確定要清空本次新增的項目嗎？")) {
      setItems([]);
      setPreviewImage(null);
    }
  };

  const completeSettlement = async () => {
    if (items.length === 0) return;
    if (!confirm("確定要儲存這筆紀錄嗎？儲存後清單將會清空並存入歷史紀錄。")) return;

    const currentTotals = totals;
    const record: SettlementRecord = {
      id: crypto.randomUUID(),
      date: selectedDate,
      huanTotal: currentTotals.huanTotal,
      yanTotal: currentTotals.yanTotal,
      grandTotal: currentTotals.total,
      itemCount: items.length,
      items: [...items]
    };

    setIsAnalyzing(true); // Reusing analyzing state for loading UI
    try {
      await saveSettlementToSupabase(record);
      setHistory([record, ...history]);
      setItems([]);
      setPreviewImage(null);
      alert("儲存至 Supabase 成功！");
    } catch (err: any) {
      console.error("Supabase Save Error:", err);
      // Even if Supabase fails, we might still want it in LocalStorage? 
      // User requested saving to Supabase, so let's keep the items if it fails.
      setError(`儲存至 Supabase 失敗：${err.message || "請檢查 API Key 或網路"}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteHistoryRecord = async (id: string) => {
    if (confirm("確定要刪除這筆歷史紀錄嗎？")) {
      setIsAnalyzing(true);
      try {
        await deleteHistoryFromSupabase(id);
        setHistory(prev => prev.filter(h => h.id !== id));
        alert("刪除成功！");
      } catch (err: any) {
        console.error("Delete Error:", err);
        setError(`刪除失敗：${err.message || "請檢查網路連線"}`);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const isHistoryMode = selectedHistoryRecords.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      {/* Header - Conditional based on Tab */}
      {activeTab === 'register' ? (
        <header className="bg-indigo-600 text-white p-6 pb-12 rounded-b-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 rounded-full -mr-32 -mt-32 opacity-20"></div>
          <div className="relative z-10 max-w-md mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                  <Plus className="w-6 h-6 text-indigo-200" />
                  新增帳目
                </h1>
                <p className="text-indigo-100/60 text-xs font-bold uppercase tracking-wider mt-1">
                  請上傳收據進行 AI 辨識
                </p>
              </div>
              <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-md border border-white/10">
                <Receipt className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-8 flex items-center gap-3 bg-white/10 w-fit p-1 rounded-full border border-white/5 backdrop-blur-md">
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - 1);
                  setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
                className="p-1.5 hover:bg-white/10 rounded-full transition-all active:scale-90"
              >
                <ChevronLeft className="w-4 h-4 text-indigo-200" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white font-black text-sm outline-none cursor-pointer appearance-none text-center"
              />
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() + 1);
                  setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
                className="p-1.5 hover:bg-white/10 rounded-full transition-all active:scale-90"
              >
                <ChevronRight className="w-4 h-4 text-indigo-200" />
              </button>
            </div>
          </div>
        </header>
      ) : (
        <header className="bg-slate-900 text-white p-6 pb-12 rounded-b-[3rem] shadow-2xl relative overflow-hidden sticky top-0 z-30">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-800 rounded-full -mr-32 -mt-32 opacity-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500 rounded-full -ml-16 -mb-16 opacity-10"></div>

          <div className="relative z-10 flex flex-col gap-4 max-w-md mx-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-white p-2 rounded-xl text-slate-900 shadow-lg">
                  <History className="w-5 h-5 font-black" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-white">
                    紀錄查詢
                  </h1>
                  <p className="text-emerald-400/80 text-[10px] font-bold uppercase tracking-wider mt-0.5">
                    {selectedHistoryRecords.length > 0 ? `共 ${selectedHistoryRecords.length} 筆紀錄` : '尚未有紀錄'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
                  <CalendarDays className="w-5 h-5 text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10">
              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setMonth(d.getMonth() - 1);
                  setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-90"
              >
                <ChevronLeft className="w-5 h-5 text-slate-300" />
              </button>

              <div className="flex-1 text-center relative px-2">
                <input
                  type="month"
                  value={selectedDate.substring(0, 7)}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split('-');
                    setSelectedDate(`${year}-${month}-01`);
                  }}
                  className="bg-transparent text-white font-black text-lg w-full text-center outline-none cursor-pointer appearance-none selection:bg-emerald-500/30"
                />
              </div>

              <button
                onClick={() => {
                  const d = new Date(selectedDate);
                  d.setMonth(d.getMonth() + 1);
                  setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all active:scale-90"
              >
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-md mx-auto px-4 py-8 space-y-6">
        {activeTab === 'inquiry' && isHistoryMode && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-700 animate-in fade-in duration-500">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 text-sm font-medium">
              這是已存檔的紀錄（唯讀模式）。
            </div>
          </div>
        )}

        {/* Dashboard Summary Card */}
        <section className={`rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 transition-all duration-500 ${isHistoryMode ? 'bg-gradient-to-br from-slate-700 to-slate-900' : 'bg-gradient-to-br from-indigo-600 to-indigo-800'
          }`}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1 opacity-80">
                {activeTab === 'inquiry' ? <TrendingUp className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {activeTab === 'inquiry' ? `${selectedDate.split('-')[1]}月 累計支出` : '本日預計支出'}
              </p>
              <h2 className="text-3xl font-black tracking-tight">
                ${(activeTab === 'inquiry' ? monthlyTotals.total : totals.total).toLocaleString()}
              </h2>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider mb-0.5 opacity-70">桓 應付</p>
              <p className="text-xl font-black">
                ${(activeTab === 'inquiry' ? monthlyTotals.huanTotal : totals.huanTotal).toLocaleString()}
              </p>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
              <p className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider mb-0.5 opacity-70">妍 應付</p>
              <p className="text-xl font-black">
                ${(activeTab === 'inquiry' ? monthlyTotals.yanTotal : totals.yanTotal).toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {activeTab === 'register' && (
          <section className="animate-in slide-in-from-top-4 duration-300">
            {!previewImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center bg-white cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group shadow-sm"
              >
                <div className="bg-slate-100 p-4 rounded-full mb-3 group-hover:scale-110 group-hover:bg-indigo-100 transition-all">
                  <Receipt className="text-slate-400 group-hover:text-indigo-600 w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 text-sm">上傳收據 AI 辨識</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </div>
            ) : (
              <div className="relative rounded-3xl overflow-hidden shadow-xl aspect-[21/9] bg-slate-900 border-4 border-white">
                <img src={previewImage} className="w-full h-full object-contain opacity-80" alt="Receipt preview" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4">
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                      <p className="font-bold text-xs tracking-wide">分析中...</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 bg-white text-slate-900 px-5 py-2 rounded-full font-bold shadow-xl hover:scale-105 active:scale-95 transition-all text-xs"
                    >
                      <Camera className="w-4 h-4" />
                      <span>重新拍攝</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex gap-3 text-rose-700 animate-in shake-1">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Items List */}
        <section className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              {activeTab === 'inquiry' ? '查得項目明細' : 'AI 辨識清單'}
            </h2>
            {activeTab === 'register' && items.length > 0 && (
              <button
                onClick={clearItems}
                className="text-xs text-slate-400 hover:text-rose-500 font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all hover:bg-rose-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                清空重來
              </button>
            )}
          </div>

          <div className="space-y-6">
            {activeTab === 'inquiry' ? (
              // Inquiry Mode: Show records for the whole month
              selectedHistoryRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-300 bg-white rounded-3xl border border-slate-100 border-dashed">
                  <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                    <Receipt className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium">該月份尚無紀錄</p>
                </div>
              ) : (
                selectedHistoryRecords.map((record) => (
                  <div key={record.id} className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-bold text-slate-500">{record.date}</span>
                      </div>
                    </div>
                    {record.items.map((item) => (
                      <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between gap-3 mb-4">
                          <span className="flex-1 font-bold text-slate-800">{item.name}</span>
                          <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-lg">
                            <span className="text-slate-400 font-bold text-xs">$</span>
                            <span className="w-20 text-right font-black text-indigo-600 text-lg">{item.amount.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-50">
                          <div className="flex flex-col gap-2 items-end">
                            <div className="flex p-1 rounded-xl w-fit bg-slate-50/30">
                              {(['桓', '妍', '平分'] as Payer[]).map((p) => (
                                <button
                                  key={p}
                                  disabled
                                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${item.payer === p
                                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-400 opacity-30'
                                    }`}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                            {item.payer === '平分' && (
                              <p className="text-[10px] font-bold text-slate-400">
                                桓: ${Math.ceil(item.amount / 2).toLocaleString()} / 妍: ${Math.floor(item.amount / 2).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )
            ) : (
              // Register Mode: Show items for the current draft
              <>
                {items.length === 0 && !isAnalyzing && (
                  <div className="text-center py-12 text-slate-300 bg-white rounded-3xl border border-slate-100 border-dashed">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                      <Receipt className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium">請上傳收據或拍攝</p>
                  </div>
                )}

                {items.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md group">
                    <div className="flex justify-between gap-3 mb-4">
                      <input
                        className="flex-1 font-bold text-slate-800 bg-transparent border-none focus:ring-0 p-0 text-base placeholder:text-slate-300"
                        value={item.name}
                        placeholder="項目名稱..."
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      />
                      <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-lg">
                        <span className="text-slate-400 font-bold text-xs">$</span>
                        <input
                          type="number"
                          className="w-20 text-right font-black text-indigo-600 bg-transparent border-none focus:ring-0 p-0 text-lg placeholder:text-slate-300"
                          value={item.amount || ''}
                          placeholder="0"
                          onChange={(e) => updateItem(item.id, { amount: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-50">
                      <div className="flex flex-col gap-2">
                        <div className="flex p-1 rounded-xl w-fit bg-slate-100/50">
                          {(['桓', '妍', '平分'] as Payer[]).map((p) => (
                            <button
                              key={p}
                              onClick={() => updateItem(item.id, { payer: p })}
                              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${item.payer === p
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                        {item.payer === '平分' && (
                          <p className="text-[10px] font-bold text-indigo-400 ml-1">
                            桓: ${Math.ceil(item.amount / 2).toLocaleString()} / 妍: ${Math.floor(item.amount / 2).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {activeTab === 'register' && items.length > 0 && (
            <div className="pt-8 animate-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={completeSettlement}
                disabled={isAnalyzing}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl shadow-slate-200 hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
                儲存至 Supabase
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around p-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl">
        <button
          onClick={() => setActiveTab('register')}
          className={`flex flex-col items-center gap-1 transition-all px-8 py-2 rounded-2xl ${activeTab === 'register' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}
        >
          <Camera className={`w-6 h-6 ${activeTab === 'register' ? 'fill-indigo-600/20' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">記帳</span>
        </button>
        <button
          onClick={() => setActiveTab('inquiry')}
          className={`flex flex-col items-center gap-1 transition-all px-8 py-2 rounded-2xl ${activeTab === 'inquiry' ? 'bg-slate-50 text-slate-800' : 'text-slate-400'}`}
        >
          <History className={`w-6 h-6 ${activeTab === 'inquiry' ? 'fill-slate-800/10' : ''}`} />
          <span className="text-[10px] font-black uppercase tracking-widest">查詢</span>
        </button>
      </nav>

      <footer className="h-20"></footer>
    </div>
  );
};

export default App;
