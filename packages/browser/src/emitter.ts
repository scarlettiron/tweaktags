//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//A listener that receives a value when an emitter fires.
export type Listener<T> = (value: T) => void;

//A tiny typed event emitter. The engine uses one of these for each kind of
//update, so any UI, React or vanilla, can subscribe and react.
export class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>();

  //Adds a listener and returns a function that removes it again.
  public subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  //Sends a value to every current listener. We copy the set first so a listener
  //that unsubscribes during the loop does not disturb it.
  public emit(value: T): void {
    for (const listener of Array.from(this.listeners)) {
      listener(value);
    }
  }
}
