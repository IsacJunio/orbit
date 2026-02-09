// This file is deprecated - types are now defined inline where needed.

export interface Order {
    id: string
    orderNumber: string
    quoteNumber?: string
    vendor: string
    requester?: string
    requesters?: { name: string; items: string }[]
    amount: number
    status: string
    deliveryDate?: string
    createdAt: string
    attachedFiles?: string[]
}

export interface Task {
    id: string
    title: string
    description?: string
    status: string
    priority: string
    dueDate?: string
    tags?: string[]
    createdAt: string
}

export interface Document {
    id: string
    name: string
    type: string
    category: string
    orderNumber?: string
    files?: { id: string; name: string; path?: string; addedAt: string }[]
    notes?: string
    createdAt: string
}
