'use client';

import React, { useState } from 'react';
import { MenuItem, SelectedModifier } from '@/types';
import { X, Plus, Minus, Check } from 'lucide-react';

interface MenuItemModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (data: {
    menuItemId: string;
    name: string;
    basePrice: number;
    quantity: number;
    notes: string;
    selectedModifiers: SelectedModifier[];
  }) => void;
}

export function MenuItemModal({ item, onClose, onAddToCart }: MenuItemModalProps) {
  if (!item) return null;

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  // Single-select modifiers (Sambal)
  const [selectedSingles, setSelectedSingles] = useState<{ [groupId: string]: string }>(() => {
    const initial: { [groupId: string]: string } = {};
    if (item.modifier_groups) {
      for (const group of item.modifier_groups) {
        if (group.is_required && group.max_selection === 1 && group.options.length > 0) {
          initial[group.id] = group.options[0].id;
        }
      }
    }
    return initial;
  });

  // Multi-select modifiers (Add-ons with quantity support)
  const [selectedMulti, setSelectedMulti] = useState<{ [optionId: string]: number }>({});

  const handleIncrementMulti = (optId: string) => {
    setSelectedMulti((prev) => ({
      ...prev,
      [optId]: (prev[optId] || 0) + 1,
    }));
  };

  const handleDecrementMulti = (optId: string) => {
    setSelectedMulti((prev) => {
      const current = prev[optId] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[optId];
        return next;
      }
      return {
        ...prev,
        [optId]: current - 1,
      };
    });
  };

  let modifierTotal = 0;
  const activeModifiers: SelectedModifier[] = [];

  if (item.modifier_groups) {
    for (const group of item.modifier_groups) {
      if (group.max_selection === 1) {
        const selectedOptId = selectedSingles[group.id];
        const opt = group.options.find((o) => o.id === selectedOptId);
        if (opt) {
          modifierTotal += opt.price;
          activeModifiers.push({
            groupTitle: group.title,
            optionId: opt.id,
            optionName: opt.name,
            price: opt.price,
            quantity: 1,
          });
        }
      } else {
        for (const opt of group.options) {
          const optQty = selectedMulti[opt.id] || 0;
          if (optQty > 0) {
            modifierTotal += opt.price * optQty;
            activeModifiers.push({
              groupTitle: group.title,
              optionId: opt.id,
              optionName: opt.name,
              price: opt.price,
              quantity: optQty,
            });
          }
        }
      }
    }
  }

  const grandTotal = (item.base_price + modifierTotal) * quantity;

  const canSubmit = () => {
    if (!item.modifier_groups) return true;
    for (const group of item.modifier_groups) {
      if (group.is_required && group.max_selection === 1) {
        if (!selectedSingles[group.id]) return false;
      }
    }
    return true;
  };

  const handleSubmit = () => {
    if (!canSubmit()) return;
    onAddToCart({
      menuItemId: item.id,
      name: item.name,
      basePrice: item.base_price,
      quantity,
      notes,
      selectedModifiers: activeModifiers,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-lg sm:rounded-lg max-h-[90vh] flex flex-col shadow-xl overflow-hidden border border-[#E6DCD5]">
        {/* Header */}
        <div className="border-b border-[#EFE8E2] px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base text-[#1C1917] line-clamp-1">
              {item.name}
            </h3>
            <span className="text-xs font-mono font-semibold text-[#D9381E] tabular-nums">
              Rp {item.base_price.toLocaleString('id-ID')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#78716C] hover:text-[#1C1917] hover:bg-[#FAF6F3] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-5 flex-1 text-sm">
          {item.image_url && (
            <div className="rounded-md overflow-hidden aspect-video bg-[#FAF6F3] border border-[#E6DCD5]">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {item.description && (
            <p className="text-xs text-[#57534E] leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Modifier Groups */}
          {item.modifier_groups && item.modifier_groups.map((group) => {
            const isSingle = group.max_selection === 1;

            return (
              <div key={group.id} className="pt-3 border-t border-[#EFE8E2] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-[#1C1917]">
                    {group.title}
                  </span>
                  <span className="text-[11px] font-medium text-[#D9381E] bg-[#FCEAE6] px-2 py-0.5 rounded border border-[#F5D0C8]">
                    {group.is_required ? 'Wajib pilih 1' : 'Opsional'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {group.options.map((opt) => {
                    const isAvailable = opt.is_available !== false;

                    if (isSingle) {
                      const isSelected = selectedSingles[group.id] === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => {
                            if (!isAvailable) return;
                            setSelectedSingles((prev) => ({ ...prev, [group.id]: opt.id }));
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-md border text-left text-xs transition ${
                            !isAvailable
                              ? 'opacity-40 border-[#E6DCD5] bg-stone-100 cursor-not-allowed text-[#78716C]'
                              : isSelected
                              ? 'border-[#D9381E] bg-[#FAF6F3] text-[#1C1917] font-semibold'
                              : 'border-[#E6DCD5] hover:border-[#D9381E]/40 text-[#44403C]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded-full flex items-center justify-center border transition ${
                                !isAvailable
                                  ? 'border-stone-300 bg-stone-200'
                                  : isSelected
                                  ? 'border-[#D9381E] bg-[#D9381E] text-white'
                                  : 'border-[#A8A29E]'
                              }`}
                            >
                              {isSelected && isAvailable && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span>
                              {opt.name}
                              {!isAvailable && (
                                <span className="ml-1.5 text-[10px] text-red-600 font-semibold">(Habis)</span>
                              )}
                            </span>
                          </div>

                          {opt.price > 0 && (
                            <span className={`font-mono tabular-nums font-medium ${isAvailable ? 'text-[#D9381E]' : 'text-stone-400'}`}>
                              +Rp {opt.price.toLocaleString('id-ID')}
                            </span>
                          )}
                        </button>
                      );
                    }

                    // Multi-select modifier with quantity counter
                    const optQty = selectedMulti[opt.id] || 0;
                    const isSelected = optQty > 0;

                    return (
                      <div
                        key={opt.id}
                        className={`w-full flex items-center justify-between px-3.5 py-2 rounded-md border text-left text-xs transition ${
                          !isAvailable
                            ? 'opacity-40 border-[#E6DCD5] bg-stone-100 cursor-not-allowed text-[#78716C]'
                            : isSelected
                            ? 'border-[#D9381E] bg-[#FAF6F3] text-[#1C1917]'
                            : 'border-[#E6DCD5] hover:border-[#D9381E]/40 text-[#44403C]'
                        }`}
                      >
                        <div
                          className={`flex-1 min-w-0 pr-2 ${isAvailable ? 'cursor-pointer select-none' : 'cursor-not-allowed'}`}
                          onClick={() => {
                            if (!isAvailable) return;
                            if (optQty === 0) handleIncrementMulti(opt.id);
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`font-medium ${isSelected ? 'font-semibold text-[#1C1917]' : 'text-[#44403C]'}`}>
                              {opt.name}
                            </span>
                            {!isAvailable && (
                              <span className="text-[10px] text-red-600 font-semibold">(Habis)</span>
                            )}
                          </div>
                          {opt.price > 0 && (
                            <span className="text-[11px] font-mono text-[#D9381E] font-medium">
                              +Rp {opt.price.toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>

                        {isAvailable && (
                          optQty === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleIncrementMulti(opt.id)}
                              className="px-2.5 py-1 rounded text-xs font-semibold bg-white border border-[#DCD2CB] hover:border-[#D9381E] text-[#1C1917] hover:text-[#D9381E] transition flex items-center gap-1 shrink-0"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Tambah</span>
                            </button>
                          ) : (
                            <div className="flex items-center border border-[#D9381E] rounded-md bg-white overflow-hidden shrink-0 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleDecrementMulti(opt.id)}
                                className="p-1.5 hover:bg-[#FCEAE6] text-[#D9381E] transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-7 text-center font-mono font-bold text-xs tabular-nums text-[#D9381E]">
                                {optQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleIncrementMulti(opt.id)}
                                className="p-1.5 hover:bg-[#FCEAE6] text-[#D9381E] transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div className="pt-3 border-t border-[#EFE8E2] space-y-1.5">
            <label className="font-medium text-xs text-[#44403C] block">
              Catatan Menu (Opsional)
            </label>
            <input
              type="text"
              placeholder="Catatan menu..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-md border border-[#DCD2CB] bg-[#FAF6F3] text-[#1C1917] focus:bg-white focus:outline-hidden focus:border-[#D9381E] transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#EFE8E2] bg-white flex items-center gap-3">
          <div className="flex items-center border border-[#DCD2CB] rounded-md overflow-hidden bg-[#FAF6F3]">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="p-2.5 hover:bg-[#EFE8E2] transition text-[#44403C]"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center font-mono font-semibold text-xs tabular-nums text-[#1C1917]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="p-2.5 hover:bg-[#EFE8E2] transition text-[#44403C]"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={!canSubmit()}
            onClick={handleSubmit}
            className="flex-1 bg-[#D9381E] hover:bg-[#C02E16] text-white font-semibold py-2.5 px-4 rounded-md flex items-center justify-between text-xs transition disabled:opacity-50"
          >
            <span>Tambah ke Pesanan</span>
            <span className="font-mono tabular-nums">Rp {grandTotal.toLocaleString('id-ID')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
