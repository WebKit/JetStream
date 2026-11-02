(()=>{var __webpack_require__={d:(exports,definition)=>{for(var key in definition)__webpack_require__.o(definition,key)&&!__webpack_require__.o(exports,key)&&Object.defineProperty(exports,key,{enumerable:!0,get:definition[key]})},o:(obj,prop)=>Object.prototype.hasOwnProperty.call(obj,prop),r:exports=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(exports,"__esModule",{value:!0})}},__webpack_exports__={};(()=>{"use strict";__webpack_require__.r(__webpack_exports__),__webpack_require__.d(__webpack_exports__,{runTest:()=>runTest});class Executor{static#stack=[];static report(adm,property,set=!1){
/*ThouShaltNotCache*/
if(!this.#stack.length)return;const runnable=this.#stack[this.#stack.length-1];set?adm.unsubscribe(property,runnable):adm.subscribe(property,runnable)}static execute(runnable,...rest){
/*ThouShaltNotCache*/
runnable.active=!0,runnable.deps?this.dispose(runnable):runnable.deps=new Set,this.#stack.push(runnable);const result=runnable.run(...rest);return this.#stack.pop(),runnable.active=!1,result}static dispose(runnable){
/*ThouShaltNotCache*/
runnable.deps.forEach(this.unsubscribe,runnable)}static unsubscribe(list){
/*ThouShaltNotCache*/
list.delete(this)}}class Notifier{static queued=!1;static runId=2;static notify(runnable,changes){
/*ThouShaltNotCache*/
runnable.runId=Notifier.runId,runnable.subscriber(changes),Notifier.queued||(Notifier.queued=!0,queueMicrotask(Notifier.flush))}static flush(){
/*ThouShaltNotCache*/
Notifier.queued=!1,Notifier.runId=(Notifier.runId+1)%1e5}}class GlobalState{static untracked=!1;static action=!1;static queue=new Set;static meta=new WeakMap;static executor=Executor;static notifier=Notifier}const LibName=Symbol.for("kr-observable");globalThis[LibName]||(globalThis[LibName]=Object.seal(GlobalState));const global_Global=globalThis[LibName],queue=(global_Global.executor,global_Global.queue),notifier=global_Global.notifier;class Admin{static meta={key:"",adm:new Admin("")};owner;deps=new Map;listeners;changes=new Set;current=null;queued=!1;constructor(owner){
/*ThouShaltNotCache*/
this.owner=owner}subscribe(property,runnable){
/*ThouShaltNotCache*/
let list=this.deps.get(property);list||(list=new Set,this.deps.set(property,list)),list.has(runnable)||list.add(runnable),runnable.deps?.has(list)||runnable.deps?.add(list)}unsubscribe(property,runnable){
/*ThouShaltNotCache*/
this.deps.get(property)?.delete(runnable)}report(property,value){if(
/*ThouShaltNotCache*/
this.listeners?.forEach(cb=>cb(property,value)),this.deps.has(property))if(this.changes.add(property),global_Global.action)queue.add(this);else{if(this.queued)return;this.queued=!0,queueMicrotask(this.enqueueBatch)}}enqueueBatch=()=>{
/*ThouShaltNotCache*/
this.batch(),this.queued=!1};batch(flag=!1){
/*ThouShaltNotCache*/
if(0===this.changes.size)return;const changes=this.changes;if(changes.size>1){const copy=new Set;for(const key of this.deps.keys())changes.has(key)&&copy.add(key);this.changes=copy}for(const change of this.changes){this.changes.delete(change),this.current=this.deps.get(change);for(const sub of this.current)if(sub.runId!==notifier.runId){if(sub.active)return;if(flag&&sub.computed)return this.changes.add(change);notifier.notify(sub,changes)}this.current=null}}static batch(adm){
/*ThouShaltNotCache*/
adm.batch()}}class Utils_Utils{static AdmKey=Symbol.for("adm");static IGNORED=0;static ACCESSOR=1;static SHALLOW=2;static WRITABLE=3;static isPlainObject(value){
/*ThouShaltNotCache*/
const ctor=value?.constructor;return!ctor||ctor===Object}static isPrimitive(val){
/*ThouShaltNotCache*/
return null===val||"object"!=typeof val&&"function"!=typeof val}static isDeepEqual(a,b){
/*ThouShaltNotCache*/
if(null==a||null==b)return Object.is(a,b);const A=a.valueOf(),B=b.valueOf();if("object"==typeof A){if("object"!=typeof B)return!1;const keys=Object.keys(A);if(keys.length!==Object.keys(B).length)return!1;for(const key of keys)if(!Utils_Utils.isDeepEqual(A[key],B[key]))return!1;return!0}return Object.is(a,b)}static getAdm(value){
/*ThouShaltNotCache*/
return value[Utils_Utils.AdmKey]}}const registry=new Map,error=new TypeError("First argument must be Observable"),subscribersRegistry=new Map;function autorun(work){
/*ThouShaltNotCache*/
let disposer=registry.get(work);if(disposer)return disposer;const runnable={run:work,subscriber(){
/*ThouShaltNotCache*/
global_Global.executor.execute(this)},debug:!1,runId:1,active:!1,deps:void 0};return disposer=()=>{
/*ThouShaltNotCache*/
registry.delete(work),global_Global.executor.dispose(runnable)},registry.set(work,disposer),global_Global.executor.execute(runnable),disposer}class Computed{enumerable;configurable;set;runId=1;debug=!1;active=!1;deps;#adm;#property;#descriptor;#value;#setterValue;changed=!1;computed=!0;name;constructor(property,descriptor,handler){
/*ThouShaltNotCache*/
this.enumerable=descriptor.enumerable,this.configurable=descriptor.configurable,this.#property=property,this.#descriptor=descriptor,this.#adm=handler.adm,descriptor.set&&(this.set=value=>{
/*ThouShaltNotCache*/
this.#descriptor.set(value);const prevValue=this.#setterValue;this.#setterValue=value,this.#report(prevValue,value)})}subscriber(){
/*ThouShaltNotCache*/
this.changed=!0,0!==this.#adm.deps.get(this.#property)?.size&&this.compute()}run(){
/*ThouShaltNotCache*/
return this.#descriptor.get()}compute(){
/*ThouShaltNotCache*/
const prev=this.#value;this.#reader(),this.#report(prev,this.#value)}#report(prevValue,newValue){
/*ThouShaltNotCache*/
Utils_Utils.isDeepEqual(prevValue,newValue)||this.#adm.report(this.#property,newValue),global_Global.action||this.#adm.batch()}#reader(){
/*ThouShaltNotCache*/
this.#value=global_Global.executor.execute(this)}get=()=>(
/*ThouShaltNotCache*/
global_Global.action||this.#adm.batch(),this.deps?0===this.deps?.size?this.run():(this.changed&&(this.changed=!1,this.#reader()),this.#adm.current?.has(this)&&this.compute(),this.#value):(this.#reader(),this.#value))}const Proxy_handler_executor=global_Global.executor;class ProxyHandler{adm;types={};receiver;factory;constructor(adm,factory){
/*ThouShaltNotCache*/
this.adm=adm,this.factory=factory}#report(property,value){
/*ThouShaltNotCache*/
Proxy_handler_executor.report(this.adm,property,!0),this.adm.report(property,value)}#batch(property){
/*ThouShaltNotCache*/
this.types[property]!==Utils_Utils.IGNORED&&Proxy_handler_executor.report(this.adm,property),global_Global.action||this.adm.changes.size&&this.adm.changes.has(property)&&this.adm.batch(!0)}get(target,property){
/*ThouShaltNotCache*/
return property===Utils_Utils.AdmKey?this.adm:(this.#batch(property),target[property])}set(target,property,value){
/*ThouShaltNotCache*/
return property in this.types||(this.types[property]=Utils_Utils.WRITABLE,this.#report(property,value)),this.types[property]===Utils_Utils.ACCESSOR?Reflect.set(target,property,value):(target[property]!==value&&this.#report(property,value),Utils_Utils.isPrimitive(value)?target[property]=value:target[property]=this.factory.object(property,value,this),!0)}defineProperty(target,property,desc){
/*ThouShaltNotCache*/
return Reflect.defineProperty(target,property,this.factory.descriptor(property,desc,this))}deleteProperty(target,property){
/*ThouShaltNotCache*/
if(!(property in target))return!1;const res=Reflect.deleteProperty(target,property);return this.#report(property,void 0),res}setPrototypeOf(target,proto){
/*ThouShaltNotCache*/
const adm=Utils_Utils.getAdm(proto);return adm&&Object.assign(adm,this.adm),Reflect.setPrototypeOf(target,proto)}has(target,property){
/*ThouShaltNotCache*/
return this.#batch(property),property in target}getOwnPropertyDescriptor(target,property){
/*ThouShaltNotCache*/
return this.#batch(property),Reflect.getOwnPropertyDescriptor(target,property)}}class ActionHandler{ctx;constructor(receiver){
/*ThouShaltNotCache*/
this.ctx=receiver}apply(target,_,args){
/*ThouShaltNotCache*/
if(global_Global.action)return target.apply(this.ctx,args);global_Global.action=!0;try{let result=target.apply(this.ctx,args);const thenable=result instanceof Promise;return thenable&&(result=result.then(ActionHandler.resolve,ActionHandler.reject)),ActionHandler.flush(),global_Global.action=thenable,result}catch(e){ActionHandler.reject(e)}}static flush(){
/*ThouShaltNotCache*/
global_Global.queue.forEach(Admin.batch),global_Global.queue.clear(),global_Global.action=!1}static resolve(result){
/*ThouShaltNotCache*/
return ActionHandler.flush(),result}static reject(error){
/*ThouShaltNotCache*/
throw ActionHandler.flush(),error}}class ObservableSet extends Set{get meta(){
/*ThouShaltNotCache*/
return global_Global.meta.get(this)||Admin.meta}report(result){
/*ThouShaltNotCache*/
return this.meta.adm.report(this.meta.key,this),result}add(value){
/*ThouShaltNotCache*/
return this.report(super.add(value))}delete(value){
/*ThouShaltNotCache*/
return this.report(super.delete(value))}clear(){
/*ThouShaltNotCache*/
return super.clear(),this.report(void 0)}}class ObservableMap extends Map{static#getKey(metaKey,key){
/*ThouShaltNotCache*/
return null==key?`${metaKey}.${key}`:"object"==typeof key?key:"symbol"==typeof key?`${metaKey}.${key.description}`:`${metaKey}.${key}`}get meta(){
/*ThouShaltNotCache*/
return global_Global.meta.get(this)||Admin.meta}get size(){
/*ThouShaltNotCache*/
return global_Global.executor.report(this.meta.adm,`${this.meta.key}.keys`),super.size}keys(){
/*ThouShaltNotCache*/
return global_Global.executor.report(this.meta.adm,`${this.meta.key}.keys`),super.keys()}entries(){
/*ThouShaltNotCache*/
return global_Global.executor.report(this.meta.adm,`${this.meta.key}.entries`),super.entries()}values(){
/*ThouShaltNotCache*/
return global_Global.executor.report(this.meta.adm,`${this.meta.key}.entries`),super.values()}forEach(callback,thisArg){
/*ThouShaltNotCache*/
return global_Global.executor.report(this.meta.adm,`${this.meta.key}.entries`),super.forEach(callback,thisArg)}[Symbol.iterator](){
/*ThouShaltNotCache*/
return global_Global.executor.report(this.meta.adm,`${this.meta.key}.entries`),super[Symbol.iterator]()}has(key){
/*ThouShaltNotCache*/
return global_Global.executor.report(this.meta.adm,ObservableMap.#getKey(this.meta.key,key)),super.has(key)}get(key){
/*ThouShaltNotCache*/
return global_Global.executor.report(this.meta.adm,ObservableMap.#getKey(this.meta.key,key)),super.get(key)}set(key,value){
/*ThouShaltNotCache*/
let newValue=value;this.meta.factory&&(Utils_Utils.isPrimitive(newValue)||(newValue=this.meta.factory(this.meta.key,value,this.meta.handler)));const hasKey=super.has(key),prevValue=super.get(key),result=super.set(key,newValue);return hasKey?prevValue!==newValue&&(this.meta.adm.report(`${this.meta.key}.entries`,this),this.meta.adm.report(ObservableMap.#getKey(this.meta.key,key),newValue)):(this.meta.adm.report(`${this.meta.key}.entries`,this),this.meta.adm.report(`${this.meta.key}.keys`,this),this.meta.adm.report(ObservableMap.#getKey(this.meta.key,key),newValue)),result}delete(key){
/*ThouShaltNotCache*/
const result=super.delete(key);return result&&(this.meta.adm.report(ObservableMap.#getKey(this.meta.key,key),void 0),this.meta.adm.report(`${this.meta.key}.keys`,this),this.meta.adm.report(`${this.meta.key}.entries`,this)),result}clear(){
/*ThouShaltNotCache*/
if(0===super.size)return;const metaKey=this.meta.key;for(const key of this.keys())this.meta.adm.report(ObservableMap.#getKey(metaKey,key),void 0);super.clear(),this.meta.adm.report(`${this.meta.key}.keys`,this),this.meta.adm.report(`${this.meta.key}.entries`,this)}}class ObservableArray extends Array{get meta(){
/*ThouShaltNotCache*/
return global_Global.meta.get(this)||Admin.meta}report(result){
/*ThouShaltNotCache*/
return this.meta.adm.report(this.meta.key,this),result}prepare(items){
/*ThouShaltNotCache*/
const factory=this.meta.factory;if(!factory)return items;this.meta.adm;const key=this.meta.key,handler=this.meta.handler;if(""===key)return items;for(let i=0;i<items.length;i++)Utils_Utils.isPrimitive(items[i])||(items[i]=factory(key,items[i],handler));return items}push(...items){
/*ThouShaltNotCache*/
return this.report(super.push(...this.prepare(items)))}unshift(...items){
/*ThouShaltNotCache*/
return this.report(super.unshift(...this.prepare(items)))}splice(start,deleteCount,...items){
/*ThouShaltNotCache*/
return this.report(super.splice(start,deleteCount,...this.prepare(items)))}copyWithin(target,start,end){
/*ThouShaltNotCache*/
return this.report(super.copyWithin(target,start,end))}pop(){
/*ThouShaltNotCache*/
return this.report(super.pop())}reverse(){
/*ThouShaltNotCache*/
return this.report(super.reverse())}shift(){
/*ThouShaltNotCache*/
return this.report(super.shift())}sort(compareFn){
/*ThouShaltNotCache*/
return this.report(super.sort(compareFn))}set(i,v){
/*ThouShaltNotCache*/
return this.report(this[i]=v)}}function setDefaultTypes(types,ignore,shallow){
/*ThouShaltNotCache*/
return ignore?.forEach(key=>types[key]=Utils_Utils.IGNORED),shallow?.forEach(key=>types[key]=Utils_Utils.SHALLOW),types}Reflect.has(Array.prototype,"set")||(Array.prototype.set=function(i,value){
/*ThouShaltNotCache*/
this[i]=value});class Factory{static descriptor(property,descriptor,handler){
/*ThouShaltNotCache*/
return property in handler.types||("value"in descriptor&&descriptor.writable?handler.types[property]=Utils_Utils.WRITABLE:handler.types[property]=Utils_Utils.ACCESSOR),descriptor.get&&(descriptor.get=descriptor.get.bind(handler.receiver)),descriptor.set&&(descriptor.set=descriptor.set.bind(handler.receiver)),handler.types[property]===Utils_Utils.IGNORED||(handler.types[property]===Utils_Utils.ACCESSOR?descriptor.get&&(descriptor=new Computed(property,descriptor,handler)):Utils_Utils.isPrimitive(descriptor.value)||(descriptor.value=Factory.object(property,descriptor.value,handler))),descriptor}static object(property,value,handler){
/*ThouShaltNotCache*/
if(Utils_Utils.getAdm(value))return value;if(handler.types[property]===Utils_Utils.IGNORED)return value;if(""===value.meta?.key)return value;if(Utils_Utils.isPlainObject(value))return function(value,ignore,shallow){
/*ThouShaltNotCache*/
if(Utils_Utils.isPrimitive(value))throw Observable_error;if(!Utils_Utils.isPlainObject(value))throw Observable_error;if(Utils_Utils.getAdm(value))return value;const adm=new Admin(""),handler=new ProxyHandler(adm,Factory),proxy=new Proxy(value,handler);handler.receiver=proxy,setDefaultTypes(handler.types,ignore,shallow);for(const key in value){const descriptor=Factory.descriptor(key,Object.getOwnPropertyDescriptor(value,key),handler);descriptor.writable?value[key]=descriptor.value:Object.defineProperty(value,key,descriptor)}return proxy}(value);if("function"==typeof value)return new Proxy(value,new ActionHandler(handler.receiver));const isShallow=handler.types[property]===Utils_Utils.SHALLOW,meta={key:property.toString(),handler,adm:handler.adm,factory:isShallow?void 0:Factory.object};if(value instanceof Array){if(!isShallow)for(let i=0;i<value.length;i++)Utils_Utils.isPrimitive(value[i])||(value[i]=Factory.object(property,value[i],handler));return Object.setPrototypeOf(value,ObservableArray.prototype),global_Global.meta.set(value,meta),value}return value instanceof Map?(Object.setPrototypeOf(value,ObservableMap.prototype),global_Global.meta.set(value,meta),value):value instanceof Set?(Object.setPrototypeOf(value,ObservableSet.prototype),global_Global.meta.set(value,meta),value):value}}class Observable{constructor(){
/*ThouShaltNotCache*/
const ctor=new.target,adm=new Admin(ctor.name),handler=new ProxyHandler(adm,Factory),proxy=new Proxy(this,handler);handler.receiver=proxy,setDefaultTypes(handler.types,ctor.ignore,ctor.shallow);const chain=[];let current=ctor.prototype;for(;current!==Observable.prototype;)chain.push(current),current=Object.getPrototypeOf(current);const skip=new Set(["constructor"]);for(const proto of chain)for(const key of Reflect.ownKeys(proto)){if(skip.has(key))continue;skip.add(key);const desc=Reflect.getOwnPropertyDescriptor(proto,key);Object.defineProperty(this,key,Factory.descriptor(key,desc,handler))}return proxy}}const Observable_error=new TypeError("Invalid argument. Only plain objects are allowed");class Person extends Observable{id;name;lastMessage=null;rooms=new Set;status="Online";constructor(id,name){
/*ThouShaltNotCache*/
super(),this.id=id,this.name=name}setName(name){
/*ThouShaltNotCache*/
this.name=name}setLastMessage(message){
/*ThouShaltNotCache*/
this.lastMessage=message}addRoom(room){
/*ThouShaltNotCache*/
this.rooms.add(room)}removeRoom(room){
/*ThouShaltNotCache*/
this.rooms.delete(room)}setStatus(status){
/*ThouShaltNotCache*/
this.status=status,this.rooms.forEach(room=>{
/*ThouShaltNotCache*/
room.addStatusUpdate(this,status)})}}class Room extends Observable{name;people=new Map;messages=[];roomUpdates=[];constructor(name){
/*ThouShaltNotCache*/
super(),this.name=name}get messageCount(){
/*ThouShaltNotCache*/
return this.messages.length}get peopleCount(){
/*ThouShaltNotCache*/
return this.people.size}get lastMessage(){
/*ThouShaltNotCache*/
return this.messages.at(-1)}get members(){
/*ThouShaltNotCache*/
return Array.from(this.people.values())}addPerson(person){
/*ThouShaltNotCache*/
this.people.has(person.id)||(this.people.set(person.id,person),person.addRoom(this))}removePerson(personId){
/*ThouShaltNotCache*/
const person=this.people.get(personId);person&&(person.removeRoom(this),this.people.delete(personId))}addMessage(message){var work;
/*ThouShaltNotCache*/
work=()=>{
/*ThouShaltNotCache*/
message.author.setLastMessage(message),this.messages.push(message)},
/*ThouShaltNotCache*/
global_Global.action=!0,work(),global_Global.action=!1,global_Global.queue.forEach(Admin.batch),global_Global.queue.clear(),global_Global.notifier.flush()}addStatusUpdate(person,status){
/*ThouShaltNotCache*/
this.roomUpdates.push(`${person.name} is now ${status}`),this.roomUpdates.length>20&&(this.roomUpdates=this.roomUpdates.slice(10))}dispose(notifications){
/*ThouShaltNotCache*/
this.people.forEach(person=>person.removeRoom(this)),notifications&&notifications.removeRoom(this.name)}}class Message extends Observable{static ignore=new Set(["id","author","timestamp"]);static _nextId=0;id;text;author;timestamp;static nextId(){
/*ThouShaltNotCache*/
return Message._nextId++}constructor(text,author){
/*ThouShaltNotCache*/
super(),this.id=Message.nextId(),this.text=text,this.author=author,this.timestamp=new Date}updateText(text){
/*ThouShaltNotCache*/
this.text=text}}class Notifications extends Observable{static ignore=new Set(["lastMessage","roomDisposers"]);static roomSubscribeKeys=new Set(["lastMessage"]);lastMessages=new Map;lastMessage;roomDisposers=new Map;constructor(rooms){
/*ThouShaltNotCache*/
super(),rooms.forEach(room=>this.addRoom(room))}addRoom(room){
/*ThouShaltNotCache*/
room.lastMessage;const disposer=function(target,cb,keys){
/*ThouShaltNotCache*/
const adm=Utils_Utils.getAdm(target);if(!adm)throw error;let registered=subscribersRegistry.get(cb);if(registered)return registered.adms.has(adm)||keys.forEach(key=>adm.subscribe(key,registered.runnable)),registered.disposer;const runnable={subscriber:cb,runId:1,active:!1,deps:new Set};keys.forEach(key=>adm.subscribe(key,runnable));const disposer=()=>{
/*ThouShaltNotCache*/
subscribersRegistry.delete(cb),global_Global.executor.dispose(runnable)};return registered={runnable,disposer,adms:new Set([adm])},subscribersRegistry.set(cb,registered),disposer}(room,()=>{
/*ThouShaltNotCache*/
room.lastMessage&&this.updateLastMessage(room.name,room.lastMessage)},Notifications.roomSubscribeKeys);this.roomDisposers.set(room.name,disposer)}removeRoom(roomName){
/*ThouShaltNotCache*/
this.roomDisposers.has(roomName)&&(this.roomDisposers.get(roomName)(),this.roomDisposers.delete(roomName),this.lastMessages.delete(roomName))}updateLastMessage(roomName,message){
/*ThouShaltNotCache*/
this.lastMessages.set(roomName,message)}}function assert(condition){
/*ThouShaltNotCache*/
if(!condition)throw new Error("Assertion failure")}function runTest(){
/*ThouShaltNotCache*/
const logs=[],customLog=(...args)=>logs.push(args.join(" ")),techRoom=new Room("Tech Talk"),generalRoom=new Room("General Chat"),largeRoom=new Room("Large Meeting Room"),alice=new Person(1,"Alice"),bob=new Person(2,"Bob");techRoom.addPerson(alice),techRoom.addPerson(bob),generalRoom.addPerson(alice);const rooms=[techRoom,generalRoom,largeRoom],notifications=new Notifications(rooms);customLog("\n--- Setting up Large Meeting Room ---");const largeRoomMembers=[];for(let i=3;i<203;i++){const person=new Person(i,`Person ${i}`);largeRoomMembers.push(person),largeRoom.addPerson(person)}customLog(`[INFO] Added ${largeRoom.peopleCount} members to the large room.`),largeRoom.addPerson(alice),largeRoom.addPerson(bob),customLog("[INFO] Added Alice and Bob to the Large Meeting Room."),assert(3===alice.rooms.size),assert(alice.rooms.has(techRoom)&&alice.rooms.has(generalRoom)&&alice.rooms.has(largeRoom)),assert(2===bob.rooms.size&&bob.rooms.has(techRoom)&&bob.rooms.has(largeRoom)),customLog("[PASS] Verified Person.rooms associations with Set.");const notificationsDisposer=autorun(()=>{
/*ThouShaltNotCache*/
customLog("\n--- Global Notifications (Last Messages) ---"),0===notifications.lastMessages.size?customLog("No messages yet."):notifications.lastMessages.forEach((message,roomName)=>{
/*ThouShaltNotCache*/
customLog(`[${roomName}] "${message.text}" - ${message.author.name}`)}),customLog("------------------------------------------")}),roomUpdatesDisposer=autorun(()=>{
/*ThouShaltNotCache*/
rooms.forEach(room=>{
/*ThouShaltNotCache*/
room.roomUpdates.length>0&&customLog(`[${room.name} Update] ${room.roomUpdates[room.roomUpdates.length-1]}`)})});customLog("\n--- Status Update Scenario ---"),alice.setStatus("Away"),assert(techRoom.roomUpdates.includes("Alice is now Away")),assert(generalRoom.roomUpdates.includes("Alice is now Away")),assert(largeRoom.roomUpdates.includes("Alice is now Away")),customLog("[PASS] Verified that status updates are sent to all of Alice's rooms."),bob.setStatus("Busy"),assert(techRoom.roomUpdates.includes("Bob is now Busy")),assert(!generalRoom.roomUpdates.includes("Bob is now Busy")),assert(largeRoom.roomUpdates.includes("Bob is now Busy")),customLog("[PASS] Verified that status updates are only sent to Bob's rooms."),customLog("\n--- Sending Messages & Verifying Notifications ---");const msg1=new Message("First message to Tech Talk!",alice);techRoom.addMessage(msg1),assert(notifications.lastMessages.get("Tech Talk")===msg1),customLog("[PASS] Verified Tech Talk notification.");for(let i=0;i<20;i++){const msg2=new Message(`ping ${i}`,alice);generalRoom.addMessage(msg2),assert(notifications.lastMessages.get("General Chat")===msg2)}customLog("[PASS] Verified General Chat notification.");for(let i=0;i<=5;i++)for(const member of largeRoomMembers){const msg=new Message(`Hi, I am ${member.name}`,member);largeRoom.addMessage(msg),assert(largeRoom.lastMessage==msg),assert(notifications.lastMessages.get("Large Meeting Room")===msg)}customLog("[PASS] Verified Large Meeting Room notification.");for(let i=0;i<20;i++){const msg4=new Message(`ping ${i}`,bob);techRoom.addMessage(msg4),assert(notifications.lastMessages.get("Tech Talk")===msg4)}customLog("[PASS] Verified Tech Talk notification update.");const tempRooms=[];for(let i=0;i<10;i++){const roomId=`General Chat ${i}`,tempRoom=new Room(roomId);tempRooms.push(tempRoom),notifications.addRoom(tempRoom);for(const person of largeRoomMembers.slice(0,10))tempRoom.addPerson(person);for(const person of tempRoom.members.slice(0,5)){const msg=new Message(`ping ${i}`,person);tempRoom.addMessage(msg),assert(notifications.lastMessages.get(roomId)===msg)}}return tempRooms.forEach(room=>room.dispose(notifications)),notificationsDisposer(),roomUpdatesDisposer(),techRoom.dispose(notifications),generalRoom.dispose(notifications),largeRoom.dispose(notifications),logs}})(),MobXBenchmark=__webpack_exports__})();
//# sourceMappingURL=bundle.es6.js.map