"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JumpToPlate() {
  const router = useRouter();
  const [n, setN] = useState("");
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault();
        const v = Number.parseInt(n, 10);
        if (v > 0) router.push(`/rep/activate/${v}`);
      }}
    >
      <div className="grow">
        <label htmlFor="jump">Plate number</label>
        <input id="jump" inputMode="numeric" pattern="[0-9]*" value={n}
          onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 101" />
      </div>
      <button type="submit" style={{ alignSelf: "flex-end" }}>Open plate</button>
    </form>
  );
}
