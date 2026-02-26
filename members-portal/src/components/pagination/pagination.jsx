import { useState } from "react";
import * as Paginations from "@/components/application/pagination/pagination";

export const PaginationPageDefault = () => {
    const [currentPage, setCurrentPage] = useState(1);

    return <Paginations.PaginationPageDefault page={currentPage} onPageChange={setCurrentPage} />;
};