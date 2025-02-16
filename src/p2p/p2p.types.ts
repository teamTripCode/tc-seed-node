export enum MessageType {
    NEW_BLOCK = 'NEW_BLOCK',
    NEW_TRANSACTION = 'NEW_TRANSACTION',
    PEER_DISCOVERY = 'PEER_DISCOVERY',
}

export interface P2PMessage {
    type: MessageType;
    data: any;
}

export interface Peer {
    id: string;
    address: string;
}