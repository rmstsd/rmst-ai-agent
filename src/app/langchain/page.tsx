'use client'

import { useEffect } from 'react'

import { ChatOpenAI } from '@langchain/openai'
import { createAgent } from 'langchain'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export default function Page(props) {
  useEffect(() => {
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
      name: 'get-weather',
      description: 'Get the weather',
      schema: z.object({ location: z.string() })
    })

    const agent = createAgent({
      model,
      tools: [getWeather]
    })

    const res = await agent.invoke({
      messages: [{ role: 'user', content: '今天天气在北京的天气' }]
    })
    console.log(res)
  }

  return <div>Page</div>
}
