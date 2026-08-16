import { bookmarkAiTools } from './bookmark-ai-tools'
import { commonAiTools } from './common-ai-tool'
import { githubAiTools } from './github-ai-tools'
import { skillAiTools } from './skill-ai-tools'

export const getAllAiTools = () => [...commonAiTools, ...githubAiTools, ...bookmarkAiTools, ...skillAiTools]
