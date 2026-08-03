import type { ModuleDefinition } from '../platform/types'
import { fitnessModule } from './fitness/module'
import { groceryModule } from './grocery/module'
import { tasksModule } from './tasks/module'

/** The installed modules. Adding a life domain = adding one entry here. */
export const modules: ModuleDefinition[] = [fitnessModule, groceryModule, tasksModule]
