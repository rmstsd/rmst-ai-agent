'use client'

import { useEffect } from 'react'

import { ChatOpenAI } from '@langchain/openai'
import { BaseMessage, createAgent, humanInTheLoopMiddleware } from 'langchain'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { coerceMessageLikeToMessage, mapStoredMessageToChatMessage } from '@langchain/core/messages'
import { MemorySaver, StateGraph } from '@langchain/langgraph'

export default function Page(props) {
  useEffect(() => {
    const c = coerceMessageLikeToMessage({ role: 'human', content: '你好' })
    // console.log(c)

    // console.log(mapStoredMessageToChatMessage(c.toDict()))

    init()
  }, [])

  const init = async () => {
    const model = new ChatOpenAI({
      apiKey: 'sk-c948ff9124414de5b604aeb0e41e26df',
      model: 'deepseek-v4-flash',
      configuration: {
        dangerouslyAllowBrowser: true,
        baseURL: 'https://api.deepseek.com'
      }
    })
    const getWeather = tool(({ location }) => `今天天气在${location}的天气是晴天下雨下雪`, {
      name: 'get_weather',
      description: 'Get the weather',
      schema: z.object({ location: z.string() })
    })

    const agent = createAgent({
      model,
      tools: [getWeather],
      middleware: [
        humanInTheLoopMiddleware({
          interruptOn: {
            get_weather: true // All decisions (approve, edit, reject, respond) allowed
          },
          descriptionPrefix: '哈哈哈 Tool execution pending approval'
        })
      ],
      checkpointer: new MemorySaver()
    })

    const res = await agent.invoke({
      messages: [{ role: 'user', content: '今天天气在北京的天气' }]
    })
    console.log(res)

    const serMsg = res.messages.map(item => {
      return item.toDict()
    })
    console.log(serMsg)
  }

  return <div>Page</div>
}
