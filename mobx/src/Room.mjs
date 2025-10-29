import { makeObservable, observable, computed, action } from 'mobx';

const MAX_ROOM_UPDATES = 10;

export class Room {
    name;
    people = new Map();
    messages = [];
    roomUpdates = [];

    constructor(name) {
        makeObservable(this, {
            name: observable,
            people: observable,
            messages: observable,
            roomUpdates: observable,
            messageCount: computed,
            peopleCount: computed,
            lastMessage: computed,
            members: computed,
            addPerson: action,
            removePerson: action,
            addMessage: action,
            addStatusUpdate: action,
            dispose: action,
        });
        this.name = name;
    }

    get messageCount() {
        return this.messages.length;
    }

    get peopleCount() {
        return this.people.size;
    }

    get lastMessage() {
        if (this.messages.length === 0) {
            return null;
        }
        return this.messages[this.messages.length - 1];
    }

    get members() {
        return Array.from(this.people.values());
    }

    addPerson(person) {
        if (!this.people.has(person.id)) {
            this.people.set(person.id, person);
            person.addRoom(this);
        }
    }

    removePerson(personId) {
        const person = this.people.get(personId);
        if (person) {
            person.removeRoom(this);
            this.people.delete(personId);
        }
    }

    addMessage(message) {
        this.messages.push(message);
        message.author.setLastMessage(message);
    }

    addStatusUpdate(person, status) {
        this.roomUpdates.push(`${person.name} is now ${status}`);
        if (this.roomUpdates.length > MAX_ROOM_UPDATES * 2)
            this.roomUpdates = this.roomUpdates.slice(MAX_ROOM_UPDATES);
    }

    dispose(notifications) {
        this.people.forEach(person => person.removeRoom(this));
        if (notifications) {
            notifications.removeRoom(this.name);
        }
    }
}