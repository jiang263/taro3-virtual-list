import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import Taro, {createSelectorQuery, getSystemInfoSync} from '@tarojs/taro'
import {View, ScrollView, Block} from '@tarojs/components'
import {VirtualListProps} from "../../../@types/virtualList"
import {throttle, isH5} from '../../common/utils'


const VirtialList: React.FC<VirtualListProps> = (props) => {
  const {
    segmentNum = 10,
    pageNum = 1,
    list = [],
    listType = 'single',
    listId = "zt-virtial-list",
    scrollViewProps = {},
    screenNum = 2,
    autoScrollTop = true,
    className = "",
    onRenderTop,
    onRenderLoad,
    onRenderBottom,
    onRender,
    onComplete,
    onBottom,
    onGetScrollData
  } = props


  const [twoList, setTwoList] = useState<any[]>([])// 二维数组
  const [innerScrollTop, setInnerScrollTop] = useState(0); // 记录组件内部的滚动高度
  const [isComplete, setComplete] = useState(false);// 数据是否全部加载完成

  const windowHeight = useRef<number>(0); // / 当前屏幕的高度
  const initList = useRef<any[]>([]); // 承载初始化的二维数组
  const pageHeightArr = useRef<number[]>([])// 用来装每一屏的高度
  const currentPage = useRef(Taro.getCurrentInstance()); // 当前页面实例

  const wholePageIndex = useRef(0); // 每一屏为一个单位，屏幕索引
  const twoListRef = useRef<any[]>([]); // 缓存twoList，因为小程序observe回调里面无法拿到最新的state

  useEffect(() => {
    windowHeight.current = getSystemInfoSync().windowHeight;
  }, [])

  useEffect(() => {
    if (listType === "multi") {
      wholePageIndex.current = pageNum - 1;
    }
  }, [pageNum])

  useEffect(() => {

    if (listType === "single") {
      // 更新list时
      if (!initList.current.length) {
        // 提前把innerScrollTop置为不是0，防止列表置顶失效
        setInnerScrollTop(1);

        pageHeightArr.current = [];

        setComplete(false);
        setTwoList([]);

        Taro.nextTick(() => {
          setInnerScrollTop(0);
          if (list?.length) {
            formatList(list)
          } else {
            handleComplete()
          }
        })
      } else {
        // 初始化list
        formatList(list)
      }

    }

    if (listType === "multi") {
      formatMultiList(list);
    }
  }, [list])

  useEffect(() => {
    twoListRef.current = [...twoList]
  }, [twoList])

  /**
   * 将列表格式化为二维
   * @param  list  列表
   */
  const formatList = (list: any[] = []) => {
    segmentList(list)
    setTwoList(initList.current.slice(0, 1))

    Taro.nextTick(() => {
      setHeight()
    })
  }

  /**
   * 当list是通过服务端分页获取的时候，对list进行处理
   * @param  list 外部list
   * @param  pageNum 当前页码
   */
  const formatMultiList = (list: any[] = []) => {

    const pageNum = wholePageIndex.current;

    if (!list?.length) return;

    segmentList(list); // 分割列表

    twoList[pageNum] = initList.current[pageNum];


    setTwoList([...twoList])

    Taro.nextTick(() => {
      setHeight()
    })
  }

  /**
   * 按规则分割list，存在initList上，备用
   */
  const segmentList = (list: any[] = []) => {
    let arr: any[] = []
    const _list: any[] = []

    list.forEach((item, index) => {
      arr.push(item)
      if ((index + 1) % segmentNum === 0) {
        _list.push(arr)
        arr = []
      }
    })

    // 将分段不足segmentNum的剩余数据装入_list
    if (arr.length) {
      _list.push(arr)
      if (_list.length <= 1) {
        // 如果数据量少，不足一个segmentNum，则触发完成回调
        handleComplete()
      }
    }
    initList.current = _list
  }

  /**
   * 列表数据渲染完成
   */
  const handleComplete = () => {
    setComplete(true);

    onComplete?.()
  }

  /**
   * 设置每一个维度的数据渲染完成之后所占的高度
   */
  const setHeight = () => {
    const query = createSelectorQuery()
    query.select(`#${listId} .wrap_${wholePageIndex.current}`).boundingClientRect()
    query.exec((res) => {
      // 有数据的时候才去收集高度，不然页面初始化渲染（在H5中无数据）收集到的高度是错误的
      if (initList.current?.length) {
        pageHeightArr.current.push(res?.[0]?.height)
      }
    })
    handleObserve()
  }

  /**
   * 监听可视区域
   */
  const handleObserve = () => {
    if (isH5) {
      webObserve()
    } else {
      miniObserve()
    }
  }

  /**
   * h5监听
   */
  const webObserve = () => {
    const $targets = document.querySelectorAll(`#${listId} .zt-main-list > taro-view-core`)
    const options = {
      root: document.querySelector(`#${listId}`),
      rootMargin: "500px 0px",
      // threshold: [0.5],
    }
    const observer = new IntersectionObserver(observerCallBack, options)
    $targets.forEach($item => {
      observer?.observe($item)
    })
  }

  const observerCallBack = (entries: IntersectionObserverEntry[]) => {
    const twoList = twoListRef.current;

    entries.forEach((item) => {
      const screenIndex = item.target['data-index']
      if (item.isIntersecting) {
        // 如果有相交区域，则将对应的维度进行赋值
        twoList[screenIndex] = initList.current[screenIndex]
        setTwoList([...twoList])
      } else {
        // 当没有与当前视口有相交区域，则将改屏的数据置为该屏的高度占位
        twoList[screenIndex] = {height: pageHeightArr.current[screenIndex]}
        setTwoList([...twoList])
      }
    })
  }

  /**
   * 小程序平台监听
   */
  const miniObserve = () => {
    const currentIndex = wholePageIndex.current;

    // 以传入的scrollView的高度为相交区域的参考边界，若没传，则默认使用屏幕高度
    const scrollHeight = scrollViewProps?.style?.height || windowHeight.current
    const observer = Taro.createIntersectionObserver(currentPage.current.page!).relativeToViewport({
      top: screenNum * scrollHeight,
      bottom: screenNum * scrollHeight,
    })

    observer.observe(`#${listId} .wrap_${currentIndex}`, (res) => {
      const twoList = twoListRef.current;

      if (res?.intersectionRatio <= 0) {
        // 当没有与当前视口有相交区域，则将改屏的数据置为该屏的高度占位
        twoList[currentIndex] = {height: pageHeightArr.current[currentIndex]}

        setTwoList([...twoList])
      } else if (!twoList[currentIndex]?.length) {
        // 如果有相交区域，则将对应的维度进行赋值
        twoList[currentIndex] = initList.current[currentIndex]

        setTwoList([...twoList])
      }
    })
  }

  const renderNext = () => {
    const currentIndex = wholePageIndex.current;

    if (listType === "single") {
      const page_index = currentIndex + 1
      if (!initList.current[page_index]?.length) {
        handleComplete()

        return
      }

      onBottom?.()

      wholePageIndex.current = page_index;
      twoList[page_index] = initList.current[page_index]

      setTwoList([...twoList])

      Taro.nextTick(() => {
        setHeight()
      })
    } else if (listType === "multi") {
      scrollViewProps?.onScrollToLower?.()
    }
  }

  /**
   * scroll-view滚动回调
   */
  const handleScroll = useCallback(throttle((event: any): void => {
    onGetScrollData?.({
      [`${listId}`]: event,
    })
    scrollViewProps?.onScroll?.(event)
  }, 300, 300), [])

  const scrollTop = useMemo(() => {
    return autoScrollTop ? (innerScrollTop === 0 ? 0 : "") : scrollViewProps?.scrollTop;
  }, [innerScrollTop, autoScrollTop, scrollViewProps])


  return (
    <ScrollView
      scrollY
      id={listId}
      style={{
        height: '100%',
      }}
      onScrollToLower={renderNext}
      lowerThreshold={100}
      className={`zt-virtual-list-container ${className}`}
      scrollTop={scrollTop}
      {...scrollViewProps}
      enhanced
      onScroll={handleScroll}
    >
      {onRenderTop?.()}
      <View className="zt-main-list">
        {
          twoList?.map((item, pageIndex) => {
            return (
              <View key={pageIndex} data-index={pageIndex}
                    className={`zt-wrap-item wrap_${pageIndex}`}>
                {
                  item?.length > 0 ? (
                    <Block>
                      {
                        item.map((el, index) => {
                          return onRender?.(el, (pageIndex * segmentNum + index), pageIndex)
                        })
                      }
                    </Block>
                  ) : (
                    <View style={{'height': `${item?.height}px`}}></View>
                  )
                }
              </View>
            )
          })
        }
      </View>
      {
        onRenderLoad?.() && (
          <View className="zt-loading-text">
            {onRenderLoad()}
          </View>
        )
      }
      {isComplete && onRenderBottom?.()}
    </ScrollView>
  )
}


export default React.memo(VirtialList)
