import React, { useState, useEffect } from 'react'
import { View } from '@tarojs/components'
// import ZtVirtualList from '../../components/VirtualList'
import ZtVirtualList from '../../components/virtualList-hook'

import './index.scss'

export default function Demo(): JSX.Element {
  const [list, setList] = useState<number[]>([])
  const [pageNum, setPageNum] = useState(1)

  useEffect(() => {
    const arr: number[] = []
    Array(10).fill(0).forEach((item, index) => {
      arr.push(index)
    })
    setList(arr)
  }, [])
  // onReachBottom() {
  //   console.log('触底了----')
  //   // this.renderNext()
  //   this.setState({
  //     isBottom: true,
  //   })
  // }
  // getIsBottomStatus = (status) => {
  //   this.setState({
  //     isBottom: status,
  //   })
  // }
  const renderFunc = (item, index, pageIndex) => {
    return (
      <View className="el" key={item}>{`当前是第${item}个元素，是第${pageIndex}屏的数据`}</View>
    )
  }
  // const handleBottom = () => {
  //   console.log('触底了')
  // }
  const handleComplete = () => {
    console.log('加载完成')
  }
  // const handleGetScrollData = (e) => {
  //   console.log('scroll-data', e)
  // }
  const handleScrollToLower = () => {
    const arr: number[] = []
    Array(10).fill(0).forEach((item, index) => {
      arr.push(list.length + index)
    })
    let _list = [...list]
    _list = _list.concat(arr)

    setTimeout(() => {
      setPageNum(pageNum + 1)

      setList(_list)
    }, 1000)


    console.log('*************************************触底')

  }
  const handleRenderLoad = () => {
    return '数据载入中...'
  }
  return (
    <View>
      <ZtVirtualList
        list={list}
        pageNum={pageNum}
        segmentNum={10}
        onRender={renderFunc}
        // onBottom={handleBottom}
        onComplete={handleComplete}
        // onGetScrollData={handleGetScrollData}
        listType="multi"
        onRenderLoad={handleRenderLoad}
        scrollViewProps={{
          style: {
            "height": '100vh',
          },
          lowerThreshold: 30,
          onScrollToLower: handleScrollToLower,
        }}
      />
    </View>
  )

}
