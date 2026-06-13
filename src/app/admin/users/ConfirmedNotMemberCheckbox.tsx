"use client";

import { useState, useTransition } from "react";
import { toggleConfirmedNotMember } from "./actions";

export default function ConfirmedNotMemberCheckbox({ userId, value }: { userId: string; value: boolean }) {
    const [pending, startTransition] = useTransition();
    const [optimisticValue, setOptimisticValue] = useState(value);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newValue = e.target.checked;
        setOptimisticValue(newValue);
        startTransition(() => {
            toggleConfirmedNotMember(userId, newValue);
        });
    }

    return (
        <div className="relative inline-flex items-center justify-center w-5 h-5">
            {/* loading 遮罩 */}
            {pending && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-white/80">
                    <div className="w-3 h-3 border-2 border-[#E38043] border-t-transparent rounded-full animate-spin" />
                </div>
            )}
            <input
                type="checkbox"
                checked={optimisticValue}
                disabled={pending}
                onChange={handleChange}
                className="w-4 h-4 rounded cursor-pointer accent-[#E38043] transition hover:scale-110"
                title="确认为非成员（非社团注册用户）"
            />
        </div>
    );
}
