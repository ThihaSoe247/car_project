const getDateRange = (period) => {
    const now = new Date();
    let startDate;

    if (period === "monthly") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "6months") {
        startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    } else if (period === "yearly") {
        // 5 years history
        startDate = new Date(now.getFullYear() - 5, 0, 1);
    }

    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, now: endDate };
};
