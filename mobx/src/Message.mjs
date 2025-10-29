import { makeObservable, observable, action } from 'mobx';

export class Message {
    static _nextId = 0;
    
    id;
    text;
    author; // Person
    timestamp;

    static nextId() {
        return Message._nextId++;
    }

    constructor(text, author) {
        makeObservable(this, {
            text: observable,
            updateText: action,
        });
        this.id = Message.nextId();
        this.text = text;
        this.author = author;
        this.timestamp = new Date();
    }

    updateText(text) {
        this.text = text;
    }
}
