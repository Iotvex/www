export type Command = {
  id: string
  label: string
  do: () => void
  undo: () => void
}

export class HistoryStack {
  private undoStack: Command[] = []
  private redoStack: Command[] = []
  private limit = 200

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  execute(cmd: Command): void {
    cmd.do()
    this.undoStack.push(cmd)
    if (this.undoStack.length > this.limit) this.undoStack.shift()
    this.redoStack = []
  }

  undo(): boolean {
    const cmd = this.undoStack.pop()
    if (!cmd) return false
    cmd.undo()
    this.redoStack.push(cmd)
    return true
  }

  redo(): boolean {
    const cmd = this.redoStack.pop()
    if (!cmd) return false
    cmd.do()
    this.undoStack.push(cmd)
    return true
  }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}
