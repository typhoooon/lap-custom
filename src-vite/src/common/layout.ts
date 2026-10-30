export interface Geometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface JustifiedLayoutResult {
    boxes: Geometry[];
    containerHeight: number;
}

export function getAspectRatio(item: any): number {
    const width = Number(item?.width) > 0 ? Number(item.width) : 100;
    const height = Number(item?.height) > 0 ? Number(item.height) : 100;
    const ratio = width / height;
    return Number(item?.rotate || 0) % 180 !== 0 ? 1 / ratio : ratio;
}

export function calculateJustifiedLayout(
    items: any[],
    containerWidth: number,
    targetHeight: number,
    spacing: number | { x: number, y: number }
): JustifiedLayoutResult {
    const spacingX = typeof spacing === 'number' ? spacing : spacing.x;
    const spacingY = typeof spacing === 'number' ? spacing : spacing.y;

    const boxes: Geometry[] = [];
    let currentRow: any[] = [];
    let currentY = 0;

    // Helper to process a completed row
    const processRow = (rowItems: any[], isLastRow: boolean) => {
        if (rowItems.length === 0) return;

        // Calculate total aspect ratio of the row
        let totalAspectRatio = 0;
        rowItems.forEach(item => {
            totalAspectRatio += getAspectRatio(item);
        });

        // Calculate available width for content (minus spacing)
        const availableWidth = containerWidth - (rowItems.length - 1) * spacingX;

        let rowHeight = targetHeight;

        if (!isLastRow) {
            // For full rows, calculate exact height to fill container
            rowHeight = availableWidth / totalAspectRatio;
        } else {
            // For the last row, usually don't scale up aggressively
            // But if it's very close to full, maybe justify it? 
            // Standard behavior: keep targetHeight, right side can be empty
        }

        // Generate geometry for each item in this row
        let currentX = 0;
        rowItems.forEach(item => {
            const aspectRatio = getAspectRatio(item);

            const itemWidth = rowHeight * aspectRatio;

            boxes.push({
                x: currentX,
                y: currentY,
                width: itemWidth,
                height: rowHeight
            });

            currentX += itemWidth + spacingX;
        });

        currentY += rowHeight + spacingY;
    };

    let currentRowWidth = 0;

    items.forEach(item => {
        const aspectRatio = getAspectRatio(item);
        // Width if scaled to targetHeight
        const scaledWidth = aspectRatio * targetHeight;

        // Check if adding this item exceeds container (roughly)
        // We add spacing only if it's not the first item
        const spacingCost = currentRow.length > 0 ? spacingX : 0;

        if (currentRowWidth + spacingCost + scaledWidth > containerWidth) {
            // Row is full. 
            // We need to decide whether to include this item or wrap before it.
            // Simple greedy approach: if it overflows, wrap now.
            // Justified Layout libraries sometimes check which minimizes error.
            // For simplicity, let's wrap *before* this item if adding it makes it overflow significantly.
            // Actually, standard approach: add items until > containerWidth, then squeeze.

            // Let's try adding it first, see if the row height drops too much?
            // No, simple approach: check if current width is already reasonably full?
            // Or just: accumulate width. If > containerWidth, that's a break point.

            // Let's stick to the threshold logic:
            // If we are already > containerWidth, we MUST break.
            // But usually we break *closest* to containerWidth.

            // Let's use the simple standard algorithm: overflow triggers new row.
            // Wait, if I wrap *before* this item, the previous row might be too short (and thus very tall).
            // If I wrap *after* this item, the row is too long (and thus very short).
            // We want rowHeight to stand close to targetHeight.

            // Let's calculate cost of breaking before vs after.
            // Cost = abs(resultingRowHeight - targetHeight)

            // 1. Break BEFORE adding this item:
            // previous row has `currentRow`.
            const prevAspect = currentRow.reduce(
                (acc, it) => acc + getAspectRatio(it),
                0
            );
            const prevWidthAvail = containerWidth - Math.max(0, currentRow.length - 1) * spacingX;
            const heightIfBreakBefore = prevWidthAvail / prevAspect;

            // 2. Break AFTER adding this item (include it):
            const newRow = [...currentRow, item];
            const newAspect = prevAspect + aspectRatio;
            const newWidthAvail = containerWidth - Math.max(0, newRow.length - 1) * spacingX;
            const heightIfBreakAfter = newWidthAvail / newAspect;

            const diffBefore = Math.abs(heightIfBreakBefore - targetHeight);
            const diffAfter = Math.abs(heightIfBreakAfter - targetHeight);

            if (diffBefore < diffAfter) {
                // Break before is better (closer to target height)
                processRow(currentRow, false);
                currentRow = [item];
                currentRowWidth = scaledWidth;
            } else {
                // Include this item, then break
                processRow(newRow, false);
                currentRow = [];
                currentRowWidth = 0;
                // Note: we just processed the item as part of the previous row. 
                // So we don't add it to next row.
                // Wait, logic implementation detail:
                // if we included it, we are done with it.
                // if we didn't, it becomes the start of next row.
            }
        } else {
            currentRow.push(item);
            currentRowWidth += scaledWidth + spacingCost;
        }
    });

    // Process remaining items as last row
    if (currentRow.length > 0) {
        processRow(currentRow, true);
    }

    // Remove the last spacing from containerHeight
    const finalHeight = currentY > 0 ? currentY - spacingY : 0;

    return {
        boxes,
        containerHeight: finalHeight
    };
}

export interface LinearRowLayoutResult {
    boxes: Geometry[];
    containerWidth: number;
}

export function calculateLinearRowLayout(
    items: any[],
    targetHeight: number,
    spacing: number
): LinearRowLayoutResult {
    const boxes: Geometry[] = [];
    let currentX = 0;

    items.forEach(item => {
        const aspectRatio = getAspectRatio(item);

        const itemWidth = targetHeight * aspectRatio;

        boxes.push({
            x: currentX,
            y: 0,
            width: itemWidth,
            height: targetHeight
        });

        currentX += itemWidth + spacing;
    });

    // Remove trailing spacing from total width if items exist
    if (boxes.length > 0) {
        currentX -= spacing;
    }

    return {
        boxes,
        containerWidth: currentX
    };
}

export function calculateMasonryLayout(
    items: any[],
    containerWidth: number,
    targetWidth: number,
    spacing: number
): JustifiedLayoutResult {
    const columnCount = Math.max(1, Math.floor(containerWidth / targetWidth));
    const columnWidth = (containerWidth - (columnCount - 1) * spacing) / columnCount;
    const columnHeights = new Array(columnCount).fill(0);
    const boxes: Geometry[] = [];

    for (const item of items) {
        const itemHeight = columnWidth / getAspectRatio(item);

        let shortestCol = 0;
        for (let i = 1; i < columnCount; i++) {
            if (columnHeights[i] < columnHeights[shortestCol]) shortestCol = i;
        }

        boxes.push({
            x: shortestCol * (columnWidth + spacing),
            y: columnHeights[shortestCol],
            width: columnWidth,
            height: itemHeight,
        });
        columnHeights[shortestCol] += itemHeight + spacing;
    }

    return {
        boxes,
        containerHeight: boxes.length > 0 ? Math.max(...columnHeights) - spacing : 0,
    };
}

export interface LinearColumnLayoutResult {
    boxes: Geometry[];
    containerHeight: number;
}

export function calculateLinearColumnLayout(
    items: any[],
    targetWidth: number,
    spacing: number
): LinearColumnLayoutResult {
    const boxes: Geometry[] = [];
    let currentY = 0;

    items.forEach(item => {
        const aspectRatio = getAspectRatio(item);

        const itemHeight = targetWidth / aspectRatio;

        boxes.push({
            x: 0,
            y: currentY,
            width: targetWidth,
            height: itemHeight
        });

        currentY += itemHeight + spacing;
    });

    // Remove trailing spacing from total height if items exist
    if (boxes.length > 0) {
        currentY -= spacing;
    }

    return {
        boxes,
        containerHeight: currentY
    };
}

// ---------------------------------------------------------------------------
// Fork-only layouts (styles 4 and 5). Existing layouts above are untouched.
// ---------------------------------------------------------------------------

export const GRID_STYLE = {
    CARD: 0,
    TILE: 1,
    JUSTIFIED: 2,
    MASONRY: 3,
    BALANCED: 4,
    ENHANCED_MASONRY: 5,
} as const;

export type GridStyle = (typeof GRID_STYLE)[keyof typeof GRID_STYLE];

export function isGeometryGridStyle(style: number): boolean {
    return style >= GRID_STYLE.JUSTIFIED && style <= GRID_STYLE.ENHANCED_MASONRY;
}

function clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export interface BalancedJustifiedOptions {
    /** 0..0.8 — how strongly portrait-heavy rows are enlarged. */
    portraitBoost?: number;
    /** 1..2 — cap for the per-row target height multiplier. */
    maxRowHeightMultiplier?: number;
}

/**
 * Orientation-aware justified layout.
 *
 * Rows that contain mostly portrait photos get a taller target height, so they
 * hold fewer photos and each portrait ends up closer in visual area to a
 * landscape photo. With `portraitBoost: 0` the output matches
 * `calculateJustifiedLayout` for normally formed rows.
 */
export function calculateBalancedJustifiedLayout(
    items: any[],
    containerWidth: number,
    targetHeight: number,
    spacing: number | { x: number, y: number },
    options: BalancedJustifiedOptions = {},
): JustifiedLayoutResult {
    const spacingX = typeof spacing === 'number' ? spacing : spacing.x;
    const spacingY = typeof spacing === 'number' ? spacing : spacing.y;
    const boxes: Geometry[] = [];

    if (items.length === 0 || containerWidth <= 0 || targetHeight <= 0) {
        return { boxes, containerHeight: 0 };
    }

    const baseHeight = Math.max(1, targetHeight);
    const portraitBoost = clampNumber(Number(options.portraitBoost ?? 0.3), 0, 0.8);
    const maxFactor = clampNumber(Number(options.maxRowHeightMultiplier ?? 1.5), 1, 2);

    const rowTarget = (row: any[]): number => {
        if (row.length === 0) return baseHeight;
        let totalAspect = 0;
        for (const item of row) totalAspect += getAspectRatio(item);
        if (!(totalAspect > 0)) return baseHeight;
        const averageAspect = totalAspect / row.length;
        const factor = Math.pow(1 / averageAspect, portraitBoost);
        return baseHeight * clampNumber(factor, 1, maxFactor);
    };

    let currentRow: any[] = [];
    let currentAspect = 0;
    let currentY = 0;

    const pushRow = (row: any[], isLastRow: boolean) => {
        if (row.length === 0) return;

        let totalAspect = 0;
        for (const item of row) totalAspect += getAspectRatio(item);

        const availableWidth = containerWidth - Math.max(0, row.length - 1) * spacingX;
        const naturalHeight = totalAspect > 0 ? availableWidth / totalAspect : baseHeight;
        // Full rows stay edge-to-edge; the last row is never stretched, and a
        // single very wide panorama is clamped instead of overflowing.
        const rowHeight = isLastRow
            ? Math.min(rowTarget(row), naturalHeight)
            : naturalHeight;

        let x = 0;
        for (const item of row) {
            const itemWidth = rowHeight * getAspectRatio(item);
            boxes.push({ x, y: currentY, width: itemWidth, height: rowHeight });
            x += itemWidth + spacingX;
        }

        currentY += rowHeight + spacingY;
    };

    for (const item of items) {
        const aspectRatio = getAspectRatio(item);
        const prospectiveRow = [...currentRow, item];
        const prospectiveAspect = currentAspect + aspectRatio;
        const prospectiveTarget = rowTarget(prospectiveRow);
        const neededWidth =
            prospectiveAspect * prospectiveTarget
            + Math.max(0, prospectiveRow.length - 1) * spacingX;

        if (currentRow.length > 0 && neededWidth > containerWidth) {
            const beforeWidth = containerWidth - Math.max(0, currentRow.length - 1) * spacingX;
            const heightBefore = currentAspect > 0 ? beforeWidth / currentAspect : baseHeight;
            const afterWidth = containerWidth - Math.max(0, prospectiveRow.length - 1) * spacingX;
            const heightAfter = prospectiveAspect > 0 ? afterWidth / prospectiveAspect : baseHeight;
            const diffBefore = Math.abs(heightBefore - rowTarget(currentRow));
            const diffAfter = Math.abs(heightAfter - prospectiveTarget);

            if (diffBefore < diffAfter) {
                pushRow(currentRow, false);
                currentRow = [item];
                currentAspect = aspectRatio;
                continue;
            }

            // Including the item is closer to the boosted target, so the
            // prospective row becomes a full row.
            pushRow(prospectiveRow, false);
            currentRow = [];
            currentAspect = 0;
            continue;
        }

        currentRow = prospectiveRow;
        currentAspect = prospectiveAspect;
    }

    pushRow(currentRow, true);

    return {
        boxes,
        containerHeight: currentY > 0 ? currentY - spacingY : 0,
    };
}

export interface EnhancedMasonryOptions {
    /** 1..3 — maximum number of columns a landscape item may span. */
    maxSpan?: number;
    /** When true (default), choose the span whose rendered height is closest to one column width. */
    adaptiveSpan?: boolean;
    /** Aspect ratio at/above which a landscape item may span when adaptiveSpan is false. */
    spanThreshold?: number;
}

/**
 * Masonry layout with optional landscape spanning.
 *
 * The column model is identical to `calculateMasonryLayout`; with
 * `maxSpan: 1` the output matches it exactly. Landscape photos may occupy
 * several adjacent columns, which increases their visual area without cropping
 * (boxes keep the photo's native aspect ratio).
 */
export function calculateEnhancedMasonryLayout(
    items: any[],
    containerWidth: number,
    targetWidth: number,
    spacing: number,
    options: EnhancedMasonryOptions = {},
): JustifiedLayoutResult {
    const boxes: Geometry[] = [];

    if (items.length === 0 || containerWidth <= 0 || targetWidth <= 0) {
        return { boxes, containerHeight: 0 };
    }

    const columnCount = Math.max(1, Math.floor(containerWidth / targetWidth));
    const columnWidth = (containerWidth - (columnCount - 1) * spacing) / columnCount;
    const maxSpan = Math.max(1, Math.min(3, Math.round(Number(options.maxSpan ?? 2)), columnCount));
    const adaptiveSpan = options.adaptiveSpan !== false;
    const spanThreshold = clampNumber(Number(options.spanThreshold ?? 1.4), 1, 3);
    const columnHeights = new Array(columnCount).fill(0);

    const chooseSpan = (aspectRatio: number): number => {
        if (maxSpan <= 1) return 1;

        if (!adaptiveSpan) {
            if (maxSpan >= 3 && aspectRatio >= Math.max(2.2, spanThreshold * 1.5)) return 3;
            if (aspectRatio >= spanThreshold) return 2;
            return 1;
        }

        let bestSpan = 1;
        let bestError = Infinity;
        for (let span = 1; span <= maxSpan; span++) {
            const width = span * columnWidth + (span - 1) * spacing;
            const height = width / Math.max(0.01, aspectRatio);
            const error = Math.abs(height - columnWidth);
            // Ties prefer the wider span so ordinary landscape photos get the
            // extra area that justifies this layout.
            if (error < bestError - 1e-6 || (Math.abs(error - bestError) <= 1e-6 && span > bestSpan)) {
                bestSpan = span;
                bestError = error;
            }
        }
        return bestSpan;
    };

    for (const item of items) {
        const aspectRatio = Math.max(0.01, getAspectRatio(item));
        const span = Math.min(chooseSpan(aspectRatio), columnCount);
        const itemWidth = span * columnWidth + (span - 1) * spacing;
        const itemHeight = itemWidth / aspectRatio;

        let bestStart = 0;
        let bestTop = 0;
        let bestCost = Infinity;

        for (let start = 0; start <= columnCount - span; start++) {
            let top = 0;
            let sum = 0;
            for (let column = start; column < start + span; column++) {
                top = Math.max(top, columnHeights[column]);
                sum += columnHeights[column];
            }
            // Prefer the shortest run, and penalize the vertical hole opened by
            // spanning columns that are not already level.
            const waste = top * span - sum;
            const cost = top + 0.35 * waste;
            if (cost < bestCost - 1e-6) {
                bestCost = cost;
                bestStart = start;
                bestTop = top;
            }
        }

        boxes.push({
            x: bestStart * (columnWidth + spacing),
            y: bestTop,
            width: itemWidth,
            height: itemHeight,
        });

        const nextHeight = bestTop + itemHeight + spacing;
        for (let column = bestStart; column < bestStart + span; column++) {
            columnHeights[column] = nextHeight;
        }
    }

    // Avoid a sparse array type in the spread below.
    let maxHeight = 0;
    for (const height of columnHeights) maxHeight = Math.max(maxHeight, height);

    return {
        boxes,
        containerHeight: boxes.length > 0 ? maxHeight - spacing : 0,
    };
}
