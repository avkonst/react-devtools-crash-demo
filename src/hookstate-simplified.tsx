import React from 'react';

export type Path = ReadonlyArray<string | number>;

export type SetInitialStateAction<S> = S /*| Promise<S> | (() => S | Promise<S>)*/

export interface StateMethods<S> {
}

export type State<S> = StateMethods<S>

export type StateValueAtRoot = any; //tslint:disable-line: no-any
export type StateValueAtPath = any; //tslint:disable-line: no-any
export function createState<S>(
    initial: SetInitialStateAction<S>
): State<S> {
    const methods = createStore(initial).toMethods();
    return methods.self as State<S>;
}

export function useState<S>(
    source: SetInitialStateAction<S>
): State<S>
{
    const [value, setValue] = React.useState(() => ({ state: createStore(source) }));
    const result = useSubscribedStateMethods<S>(
        value.state,
        RootPath,
        () => setValue({ state: value.state }),
        value.state);
    return result.self;
}

const self = Symbol('self')

enum ErrorId {
    InitStateToValueFromState = 101,
    SetStateToValueFromState = 102,
    GetStateWhenPromised = 103,
    SetStateWhenPromised = 104,
    SetStateNestedToPromised = 105,
    SetStateWhenDestroyed = 106,
    GetStatePropertyWhenPrimitive = 107,
    ToJson_Value = 108,
    ToJson_State = 109,
    GetUnknownPlugin = 120,

    SetProperty_State = 201,
    SetProperty_Value = 202,
    SetPrototypeOf_State = 203,
    SetPrototypeOf_Value = 204,
    PreventExtensions_State = 205,
    PreventExtensions_Value = 206,
    DefineProperty_State = 207,
    DefineProperty_Value = 208,
    DeleteProperty_State = 209,
    DeleteProperty_Value = 210,
    Construct_State = 211,
    Construct_Value = 212,
    Apply_State = 213,
    Apply_Value = 214,
}

class StateInvalidUsageError extends Error {
    constructor(path: Path, id: ErrorId, details?: string) {
        super(`Error: HOOKSTATE-${id} [path: /${path.join('/')}${details ? `, details: ${details}` : ''}]. ` +
            `See https://hookstate.js.org/docs/exceptions#hookstate-${id}`)
    }
}

interface Subscriber {
}

interface Subscribable {
    subscribe(l: Subscriber): void;
    unsubscribe(l: Subscriber): void;
}


const RootPath: Path = [];


class Store implements Subscribable {
    private _edition: number = 0;

    private _subscribers: Set<Subscriber> = new Set();

    constructor(private _value: StateValueAtRoot) {
    }

    get edition() {
        return this._edition;
    }

    // get promised() {
    //     return this._promised;
    // }

    get(path: Path) {
        let result = this._value;
        // if (result === none) {
        //     return result;
        // }
        path.forEach(p => {
            result = result[p];
        });
        return result;
    }

    toMethods() {
        return new StateMethodsImpl<StateValueAtRoot>(
            this,
            RootPath,
            this.get(RootPath),
            this.edition,
            OnSetUsedNoAction
        )
    }

    subscribe(l: Subscriber) {
        this._subscribers.add(l);
    }

    unsubscribe(l: Subscriber) {
        this._subscribers.delete(l);
    }

    toJSON() {
        throw new StateInvalidUsageError(RootPath, ErrorId.ToJson_Value);
    }
}

function OnSetUsedNoAction() { /** no action callback */ }

// use symbol to mark that a function has no effect anymore
const UnmountedMarker = Symbol('UnmountedMarker');
OnSetUsedNoAction[UnmountedMarker] = true

class StateMethodsImpl<S> implements StateMethods<S>, /*StateMethodsDestroy,*/ Subscribable, Subscriber {
    private subscribers: Set<Subscriber> | undefined;

    // private isDowngraded: boolean | undefined;
    // private childrenCache: Record<string | number, StateMethodsImpl<StateValueAtPath>> | undefined;
    private selfCache: State<S> | undefined;
    // private valueCache: StateValueAtPath = ValueUnusedMarker;
    
    constructor(
        public readonly state: Store,
        public readonly path: Path,
        private valueSource: S,
        private valueEdition: number,
        private readonly onSetUsed: () => void
    ) { }

    subscribe(l: Subscriber) {
        if (this.subscribers === undefined) {
            this.subscribers = new Set();
        }
        this.subscribers.add(l);
    }

    unsubscribe(l: Subscriber) {
        this.subscribers!.delete(l);
    }
    
    onUnmount() {
        this.onSetUsed[UnmountedMarker] = true
    }

    get self(): State<S> {
        if (this.selfCache) {
            return this.selfCache
        }
        
        const getter = (_: object, key: PropertyKey) => {
            if (key === self) {
                return this
            }
            if (typeof key === 'symbol') {
                return undefined
            }
            if (key === 'toJSON') {
                throw new StateInvalidUsageError(this.path, ErrorId.ToJson_State);
            }
            
            throw "Expected to be unreachable in this reproducer"
            
        }
        
        this.selfCache = proxyWrap(this.path, this.valueSource,
            () => {
                // this.get() // get latest & mark used
                return this.valueSource
            },
            getter,
            (_, key, value) => {
                throw new StateInvalidUsageError(this.path, ErrorId.SetProperty_State)
            },
            false) as unknown as State<S>;
        return this.selfCache
    }
}

function proxyWrap(
    path: Path,
    // tslint:disable-next-line: no-any
    targetBootstrap: any,
    // tslint:disable-next-line: no-any
    targetGetter: () => any,
    // tslint:disable-next-line: no-any
    propertyGetter: (unused: any, key: PropertyKey) => any,
    // tslint:disable-next-line: no-any
    propertySetter: (unused: any, p: PropertyKey, value: any, receiver: any) => boolean,
    isValueProxy: boolean
) {
    const onInvalidUsage = (op: ErrorId) => {
        throw new StateInvalidUsageError(path, op)
    }
    if (typeof targetBootstrap !== 'object' || targetBootstrap === null) {
        targetBootstrap = {}
    }
    return new Proxy(targetBootstrap, {
        getPrototypeOf: (target) => {
            // should satisfy the invariants:
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/getPrototypeOf#Invariants
            const targetReal = targetGetter()
            if (targetReal === undefined || targetReal === null) {
                return null;
            }
            return Object.getPrototypeOf(targetReal);
        },
        setPrototypeOf: (target, v) => {
            return onInvalidUsage(isValueProxy ?
                ErrorId.SetPrototypeOf_State :
                ErrorId.SetPrototypeOf_Value)
        },
        isExtensible: (target) => {
            // should satisfy the invariants:
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/handler/isExtensible#Invariants
            return true; // required to satisfy the invariants of the getPrototypeOf
            // return Object.isExtensible(target);
        },
        preventExtensions: (target) => {
            return onInvalidUsage(isValueProxy ?
                ErrorId.PreventExtensions_State :
                ErrorId.PreventExtensions_Value)
        },
        getOwnPropertyDescriptor: (target, p) => {
            const targetReal = targetGetter()
            if (targetReal === undefined || targetReal === null) {
                return undefined;
            }
            const origin = Object.getOwnPropertyDescriptor(targetReal, p);
            if (origin && Array.isArray(targetReal) && p in Array.prototype) {
                return origin;
            }
            return origin && {
                configurable: true, // JSON.stringify() does not work for an object without it
                enumerable: origin.enumerable,
                get: () => propertyGetter(targetReal, p),
                set: undefined
            };
        },
        has: (target, p) => {
            if (typeof p === 'symbol') {
                return false;
            }
            const targetReal = targetGetter()
            if (typeof targetReal === 'object' && targetReal !== null) {
                return p in targetReal;
            }
            return false;
        },
        get: propertyGetter,
        set: propertySetter,
        deleteProperty: (target, p) => {
            return onInvalidUsage(isValueProxy ?
                ErrorId.DeleteProperty_State :
                ErrorId.DeleteProperty_Value)
        },
        defineProperty: (target, p, attributes) => {
            return onInvalidUsage(isValueProxy ?
                ErrorId.DefineProperty_State :
                ErrorId.DefineProperty_Value)
        },
        ownKeys: (target) => {
            const targetReal = targetGetter()
            if (Array.isArray(targetReal)) {
                return Object.keys(targetReal).concat('length');
            }
            if (targetReal === undefined || targetReal === null) {
                return [];
            }
            return Object.keys(targetReal);
        },
        apply: (target, thisArg, argArray?) => {
            return onInvalidUsage(isValueProxy ?
                ErrorId.Apply_State:
                ErrorId.Apply_Value)
        },
        construct: (target, argArray, newTarget?) => {
            return onInvalidUsage(isValueProxy ?
                ErrorId.Construct_State :
                ErrorId.Construct_Value)
        }
    });
}

function createStore<S>(initial: SetInitialStateAction<S>): Store {
    let initialValue: S = initial
    return new Store(initialValue);
}

function useSubscribedStateMethods<S>(
    state: Store,
    path: Path,
    update: () => void,
    subscribeTarget: Subscribable
) {
    const link = new StateMethodsImpl<S>(
        state,
        path,
        state.get(path),
        state.edition,
        update,
    );
    React.useEffect(() => {
        return () => {
        }
    });
    return link;
}
