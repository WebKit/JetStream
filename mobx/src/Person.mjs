import { makeObservable, observable, action } from 'mobx';

export class Person {
    id;
    name;
    lastMessage = null;
    rooms = new Set();
    status = 'Online';
    
    constructor(id, name) {
        makeObservable(this, {
            name: observable,
            lastMessage: observable,
            rooms: observable,
            status: observable,
            setName: action,
            setLastMessage: action,
            addRoom: action,
            removeRoom: action,
            setStatus: action,
        });
        this.id = id;
        this.name = name;
    }

    setName(name) {
        this.name = name;
    }

    setLastMessage(message) {
        this.lastMessage = message;
    }

    addRoom(room) {
        this.rooms.add(room);
    }

    removeRoom(room) {
        this.rooms.delete(room);
    }

    setStatus(status) {
        this.status = status;
        this.rooms.forEach(room => {
            room.addStatusUpdate(this, status);
        });
    }
}
