import React, { useState } from "react";
import {
    Plus,
    Trash2,
    ShieldCheck,
    Layers,
    Tag,
    Edit2,
    Check,
    X,
    Sparkles,
} from "lucide-react";
import type { TechnologyItem } from "../../types/project";
import { NeoSelect } from "../NeoSelect";

export const TECH_CATEGORIES = [
    "Languages",
    "Frontend",
    "Backend",
    "Database",
    "Authentication",
    "Cloud / Hosting",
    "DevOps",
    "AI / ML",
    "Testing",
    "Development tools",
    "Other",
] as const;

export type TechCategoryName = (typeof TECH_CATEGORIES)[number];

interface TechnologyStackEditorProps {
    categorizedTech: Record<string, TechnologyItem[]>;
    onChange: (updated: Record<string, TechnologyItem[]>) => void;
    suggestedTech?: string[];
}

export const TechnologyStackEditor: React.FC<TechnologyStackEditorProps> = ({
    categorizedTech,
    onChange,
    suggestedTech = [],
}) => {
    const [selectedCategory, setSelectedCategory] = useState<TechCategoryName>("Languages");
    const [newTechName, setNewTechName] = useState("");
    const [editingItem, setEditingItem] = useState<{ category: string; index: number; name: string } | null>(null);

    // Calculate total count
    const totalCount = Object.values(categorizedTech).reduce((sum, list) => sum + list.length, 0);

    const handleAddTechnology = (categoryToAddTo?: string, techNameToAdd?: string) => {
        const cat = categoryToAddTo || selectedCategory;
        const name = (techNameToAdd || newTechName).trim();
        if (!name) return;

        const currentList = categorizedTech[cat] || [];
        // Check if already exists in this category
        if (currentList.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
            return;
        }

        const updated = {
            ...categorizedTech,
            [cat]: [
                ...currentList,
                {
                    name,
                    category: cat,
                    verified: false, // user added
                },
            ],
        };

        onChange(updated);
        if (!techNameToAdd) {
            setNewTechName("");
        }
    };

    const handleRemoveTechnology = (cat: string, index: number) => {
        const currentList = categorizedTech[cat] || [];
        const nextList = currentList.filter((_, i) => i !== index);
        const updated = {
            ...categorizedTech,
            [cat]: nextList,
        };
        onChange(updated);
    };

    const handleMoveCategory = (fromCat: string, index: number, toCat: string) => {
        if (fromCat === toCat) return;
        const currentFrom = [...(categorizedTech[fromCat] || [])];
        const [moved] = currentFrom.splice(index, 1);
        if (!moved) return;

        const currentTo = [...(categorizedTech[toCat] || [])];
        moved.category = toCat;
        currentTo.push(moved);

        const updated = {
            ...categorizedTech,
            [fromCat]: currentFrom,
            [toCat]: currentTo,
        };
        onChange(updated);
    };

    const handleSaveRename = () => {
        if (!editingItem || !editingItem.name.trim()) {
            setEditingItem(null);
            return;
        }
        const { category: cat, index, name } = editingItem;
        const currentList = [...(categorizedTech[cat] || [])];
        if (currentList[index]) {
            currentList[index] = {
                ...currentList[index],
                name: name.trim(),
            };
            onChange({
                ...categorizedTech,
                [cat]: currentList,
            });
        }
        setEditingItem(null);
    };

    return (
        <div className="space-y-5">
            {/* Header with Quick Add Form */}
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                            <Layers className="w-4 h-4" />
                            Dynamic Technology Stack ({totalCount})
                        </h4>
                        <p className="text-[11px] font-medium text-neutral-500">
                            Organize technologies into functional categories with verification provenance.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-black/10">
                    <NeoSelect
                        value={selectedCategory}
                        onChange={(val) => setSelectedCategory(val as TechCategoryName)}
                        size="sm"
                        className="shrink-0 min-w-[160px]"
                        options={TECH_CATEGORIES.map((cat) => ({ value: cat, label: cat }))}
                    />

                    <input
                        type="text"
                        value={newTechName}
                        onChange={(e) => setNewTechName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddTechnology();
                            }
                        }}
                        placeholder="Add technology (e.g. Next.js, PostgreSQL, Docker)..."
                        className="flex-1 px-3 py-2 text-xs border-2 border-black bg-white focus:outline-none"
                    />

                    <button
                        type="button"
                        onClick={() => handleAddTechnology()}
                        disabled={!newTechName.trim()}
                        className="px-4 py-2 bg-[#a2ff86] hover:bg-[#8ee673] disabled:opacity-40 text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1 active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <Plus className="w-4 h-4" />
                        Add Tech
                    </button>
                </div>

                {/* Quick Add Suggestions */}
                {suggestedTech.length > 0 && (
                    <div className="pt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-black" />
                            Suggestions:
                        </span>
                        {suggestedTech.slice(0, 10).map((tech) => {
                            const isAdded = Object.values(categorizedTech).some((list) =>
                                list.some((t) => t.name.toLowerCase() === tech.toLowerCase())
                            );
                            if (isAdded) return null;

                            return (
                                <button
                                    key={tech}
                                    type="button"
                                    onClick={() => handleAddTechnology(selectedCategory, tech)}
                                    className="px-2 py-0.5 bg-[#FAF6EE] hover:bg-black hover:text-white border border-black text-[10px] font-bold text-black transition-colors"
                                >
                                    + {tech}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Categorized Tech View */}
            <div className="space-y-3">
                {TECH_CATEGORIES.map((category) => {
                    const items = categorizedTech[category] || [];
                    if (items.length === 0) return null;

                    return (
                        <div
                            key={category}
                            className="bg-[#FAF6EE] border-2 border-black p-3.5 shadow-[2px_2px_0px_#000]"
                        >
                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-black/20">
                                <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5" />
                                    {category}
                                    <span className="text-[10px] font-mono font-bold bg-black text-white px-1.5 py-0.2">
                                        {items.length}
                                    </span>
                                </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {items.map((item, idx) => {
                                    const isEditingThis =
                                        editingItem &&
                                        editingItem.category === category &&
                                        editingItem.index === idx;

                                    if (isEditingThis) {
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-1 bg-white border-2 border-black p-1"
                                            >
                                                <input
                                                    type="text"
                                                    value={editingItem.name}
                                                    onChange={(e) =>
                                                        setEditingItem({
                                                            ...editingItem,
                                                            name: e.target.value,
                                                        })
                                                    }
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") handleSaveRename();
                                                        if (e.key === "Escape") setEditingItem(null);
                                                    }}
                                                    autoFocus
                                                    className="px-1.5 py-0.5 text-xs font-bold border border-black focus:outline-none w-28"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleSaveRename}
                                                    className="p-1 bg-[#a2ff86] text-black hover:bg-black hover:text-white"
                                                    title="Save"
                                                >
                                                    <Check className="w-3 h-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingItem(null)}
                                                    className="p-1 bg-neutral-200 text-black hover:bg-neutral-300"
                                                    title="Cancel"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={idx}
                                            className="inline-flex items-center gap-1.5 bg-white border-2 border-black px-2.5 py-1 text-xs font-bold text-black shadow-[1px_1px_0px_#000] group"
                                        >
                                            <span>{item.name}</span>

                                            {/* Verification Badge */}
                                            {item.verified ? (
                                                <span
                                                    className="inline-flex items-center text-[10px] font-mono text-emerald-800 bg-emerald-100 px-1 border border-emerald-600"
                                                    title="Verified repository fact (from manifest or GitHub API)"
                                                >
                                                    <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                                                    Fact
                                                </span>
                                            ) : (
                                                <span
                                                    className="inline-flex items-center text-[10px] font-mono text-neutral-600 bg-neutral-100 px-1 border border-neutral-300"
                                                    title="Inferred technology or user added"
                                                >
                                                    Inferred
                                                </span>
                                            )}

                                            {/* Inline category switcher */}
                                            <div className="inline-block min-w-[95px]">
                                                <NeoSelect
                                                    value={category}
                                                    onChange={(val) =>
                                                        handleMoveCategory(category, idx, val)
                                                    }
                                                    size="sm"
                                                    triggerClassName="text-[10px] py-0.5 px-1.5 h-6 border font-bold"
                                                    options={TECH_CATEGORIES.map((c) => ({ value: c, label: c }))}
                                                />
                                            </div>

                                            {/* Rename button */}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEditingItem({
                                                        category,
                                                        index: idx,
                                                        name: item.name,
                                                    })
                                                }
                                                className="text-neutral-400 hover:text-black p-0.5"
                                                title="Rename"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                            </button>

                                            {/* Delete button */}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveTechnology(category, idx)}
                                                className="text-neutral-400 hover:text-red-600 p-0.5"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
