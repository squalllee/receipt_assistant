
import { createClient } from '@supabase/supabase-js';
import { SettlementRecord, ReceiptItem, Payer } from './types';

const supabaseUrl = 'https://vngtmamxhvcldecesfwh.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveSettlementToSupabase(record: SettlementRecord) {
    // 1. Insert Summary
    const { error: summaryError } = await supabase
        .from('settlements')
        .insert([
            {
                id: record.id,
                date: record.date,
                huan_total: record.huanTotal,
                yan_total: record.yanTotal,
                grand_total: record.grandTotal
            }
        ]);

    if (summaryError) throw summaryError;

    // 2. Insert Individual Items
    const itemsToInsert = record.items.map(item => ({
        settlement_id: record.id,
        name: item.name,
        amount: item.amount,
        payer: item.payer
    }));

    const { error: itemsError } = await supabase
        .from('settlement_items')
        .insert(itemsToInsert);

    if (itemsError) throw itemsError;
}

export async function fetchHistoryFromSupabase(): Promise<SettlementRecord[]> {
    const { data, error } = await supabase
        .from('settlements')
        .select(`
      *,
      settlement_items (*)
    `)
        .order('date', { ascending: false });

    if (error) throw error;

    return data.map((s: any) => ({
        id: s.id,
        date: s.date,
        huanTotal: s.huan_total,
        yanTotal: s.yan_total,
        grandTotal: s.grand_total,
        itemCount: s.settlement_items.length,
        items: s.settlement_items.map((i: any) => ({
            id: i.id,
            name: i.name,
            amount: i.amount,
            payer: i.payer as Payer
        }))
    }));
}

export async function deleteHistoryFromSupabase(id: string) {
    const { error } = await supabase
        .from('settlements')
        .delete()
        .match({ id });

    if (error) throw error;
}
