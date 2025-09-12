import { makeObservable, observable, action, reaction } from 'mobx';

export class Notifications {
    lastMessages = new Map(); // Map<string, Message>
    lastMessage;    roomDisposers = new Map(); // Map<string, Function>

    constructor(rooms) {
        makeObservable(this, {
            lastMessages: observable,
            updateLastMessage: action,
            addRoom: action,
            removeRoom: action,
        });

        rooms.forEach(room => this.addRoom(room));
    }

    addRoom(room) {
        const disposer = reaction(
            () => room.lastMessage,
            (message) => {
                if (message) {
                    this.updateLastMessage(room.name, message);
                }
            }
        );
        this.roomDisposers.set(room.name, disposer);
    }

    removeRoom(roomName) {
        if (this.roomDisposers.has(roomName)) {
            this.roomDisposers.get(roomName)(); // Dispose the reaction
            this.roomDisposers.delete(roomName);
            this.lastMessages.delete(roomName);
        }
    }

    updateLastMessage(roomName, message) {
        this.lastMessages.set(roomName, message);
    }
}