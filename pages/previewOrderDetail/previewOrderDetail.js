
var app = getApp()
var util = require('../../utils/util.js')

Page({
  data: {
    goodsList: [],
    wayOfDine: 1,  // 1: 点餐, 2: 预约
    discountDialogHidden: true,
    discountList: [],
    selectDiscountInfo: '',
    selectDiscountIndex: -1,
    discount_cut_price: '',
    appointmentTime: '',
    phone: '',
    orderRemark: '',
    optionalTimeStart: '',
    optionalTimeEnd: '',
    location_data_arr:'',
    locationNum:'',
    locationId: 0,
    changeValue: 0,
    selectLocationId:'',
    locationTitle:'',
    isUrlLocationId:'',
    balance: '',
    useBalance: true,
    deduction: '',
    exchangeCouponData: {
      dialogHidden: true,
      goodsInfo: {},
      selectModelInfo: {},
      hasSelectGoods: false,
      voucher_coupon_goods_info: {}
    }
  },
  changeNumTimeout: [],
  franchiseeId: '',
  cartIdArr: [],
  cartGoodsIdArr: [],
  cart_data_arr: [],
  cart_id_arr:[],
  isPaysuccessFlag: false,
  onLoad: function (options) {
    this.franchiseeId = options.franchisee || '';
    this.cart_id_arr = options.cart_arr ? decodeURIComponent(options.cart_arr).split(',') : [];
    this.dataInitial();
    if(app.globalData.urlLocationId){
      this.setData({
        isUrlLocationId:app.globalData.urlLocationId,
        locationId:app.globalData.urlLocationId,
        changeValue: 2
      })
      this.getDataId();
    }
  },
  dataInitial: function () {
    this.getCartList();
    this.location();
    this.GetTostoreWaitingRule();
  },
  getCartList: function () {
    var that = this,
        franchiseeId = this.franchiseeId;

    app.sendRequest({
      url: '/index.php?r=AppShop/cartList',
      data: {
        page: 1,
        page_size: 100,
        sub_shop_app_id: franchiseeId,
        parent_shop_app_id: franchiseeId ? app.globalData.appId : ''
      },
      success: function(res){
        var shoppingCartdata = [],
            tostoreData = [];
        if(that.cart_id_arr.length){
          for (var i = 0; i <= res.data.length - 1; i++) {
            if(that.cart_id_arr.indexOf(res.data[i].id) >= 0){
              shoppingCartdata.push(res.data[i]);
            }
          }
        } else {
          shoppingCartdata = res.data;
        }
        
        for (var i = 0; i < shoppingCartdata.length;i++){
          if (shoppingCartdata[i].goods_type == 3){
            tostoreData.push(shoppingCartdata[i]);
          }
        }

        for (var i = 0; i <= tostoreData.length - 1; i++) {
          var goods = tostoreData[i],
              modelArr = goods.model_value;
          goods.model_value_str = modelArr && modelArr.join ? '('+modelArr.join('|')+')' : '';
          that.cart_data_arr.push({
            cart_id: goods.id,
            goods_id: goods.goods_id,
            model_id: goods.model_id,
            num: goods.num
          });
          that.cartIdArr.push(goods.id);
          that.cartGoodsIdArr.push(goods.goods_id)
        }

        that.setData({
          goodsList: tostoreData,
          phone: app.getUserInfo().phone
        });

        that.getCalculationPrice();
        that.getOptionalTime();
      }
    })
  },
  getCalculationPrice: function (changeBenefit){
    var that = this,
        franchiseeId = this.franchiseeId,
        selectDiscountInfo = this.data.selectDiscountInfo,
        selectDiscountIndex;
    if (changeBenefit == 'changeGoodNum'){
      selectDiscountInfo = "";
    }
    app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppShop/calculationPrice',
      method: 'post',
      data: {
        sub_shop_app_id: franchiseeId || '',
        cart_id_arr: that.cartIdArr,
        is_self_delivery: 1,
        is_balance: this.data.useBalance ? 1 : 0,
        selected_benefit: selectDiscountInfo,
        voucher_coupon_goods_info: this.data.exchangeCouponData.voucher_coupon_goods_info
      },
      success: function(res){
        var discounts = res.data.can_use_benefit.data;

        if(discounts.length){
          discounts.unshift({
            title:"不使用优惠",
            name: '无',
            no_use_benefit: 1
          })
        }

        selectDiscountInfo = res.data.selected_benefit_info;
        if (selectDiscountInfo && selectDiscountInfo.discount_type) {
          for (var i = 0; i <= discounts.length - 1; i++) {
            if (selectDiscountInfo.discount_type === discounts[i].discount_type) {
              if (selectDiscountInfo.discount_type === 'coupon') {
                if (selectDiscountInfo.coupon_id === discounts[i].coupon_id) {
                  selectDiscountIndex = i;
                  break;
                }
              } else {
                selectDiscountIndex = i;
                break;
              }
            }
          }
          // 优惠券：兑换券操作
          if(selectDiscountInfo.discount_type == 'coupon' && selectDiscountInfo.type == 3 && that.data.exchangeCouponData.hasSelectGoods == false ){
            that.exchangeCouponInit(parseInt(selectDiscountInfo.value));
          }
        }

        that.setData({
          selectDiscountIndex: selectDiscountIndex,
          discountList: discounts,
          selectDiscountInfo: selectDiscountInfo,
          discount_cut_price: res.data.discount_cut_price,
          totalPayment: res.data.price.toFixed(2),
          balance: res.data.balance,
          deduction: res.data.use_balance
        });
      }
    })
  },
  getOptionalTime: function(){
    var that = this;
    app.sendRequest({
      url: '/index.php?r=AppShop/GetTostoreNearestAppointmentTime',
      success: function(res){
        that.setData({
          optionalTimeStart: res.data.substr(11,5)
        });
      }
    })
  },
  remarkInput: function (e) {
    var value = e.detail.value;
    if (value.length > 30){
      this.setData({
        remarkColor: 'red'
      })
    }else{
      this.setData({
        remarkColor: ''
      })
    }
    this.setData({
      orderRemark: value,
      remarkLength: value.length
    });
  },
  previewImage: function (e) {
    app.previewImage({
      current: e.currentTarget.dataset.src
    });
  },
  clickMinusButton: function(e){
    var index = e.currentTarget.dataset.index,
        goods = this.data.goodsList[index];
    if(+goods.num <= 0) return;
    this.changeGoodsNum(index, 'minus');
  },
  clickPlusButton: function(e){
    var index = e.currentTarget.dataset.index;
    this.changeGoodsNum(index, 'plus');
  },
  changeGoodsNum: function(index, type){
    clearTimeout(this.changeNumTimeout[index]);
    var goods = this.data.goodsList[index],
        currentNum = +goods.num,
        targetNum = type == 'plus' ? currentNum + 1 : currentNum - 1,
        that = this,
        data = {},
        changeGoodNum = 'changeGoodNum',
        param;

    this.changeNumTimeout[index] = setTimeout(function(){
      if(targetNum == 0 && type == 'minus'){
        app.showModal({
          content: '确定从购物车删除该商品？',
          showCancel: true,
          confirm: function(){
            that.deleteGoods(index);
          }
        })
        return;
      }
      that.cart_data_arr[index].num = targetNum;

      param = {
        _app_id: app.getAppId(),
        app_id: app.getAppId(),
        session_key: app.getSessionKey(),
        goods_id: goods.goods_id,
        model_id: goods.model_id || '',
        num: targetNum,
        sub_shop_app_id: that.franchiseeId
      };

      app.sendRequest({
        url: '/index.php?r=AppShop/addCart',
        data: param,
        success: function (res) {
          that.cart_data_arr[index].num = targetNum;
          data['goodsList[' + index + '].num'] = targetNum;
          that.setData(data);
          that.getCalculationPrice(changeGoodNum);
        },
        successStatusAbnormal: function(res){
          data = {};
          that.cart_data_arr[index].num = targetNum;
          data['goodsList[' + index + '].num'] = targetNum;
          data['goodsList[' + index + '].num'] = currentNum;
          that.setData(data);
          app.showModal({
            content: res.data
          })
        },
        fail: function (res) {
          data = {};
          that.cart_data_arr[index].num = currentNum;
          data['goodsList['+index+'].num'] = currentNum;
          that.setData(data);
        }
      })

    }, 500);
  },
  deleteGoods: function(index){
    var goodsList = this.data.goodsList,
        that = this,
        listExcludeDelete,
        changeGoodNum = 'changeGoodNum';

    app.sendRequest({
      url : '/index.php?r=AppShop/deleteCart',
      method: 'post',
      data: {
        cart_id_arr: [this.cart_data_arr[index].cart_id],
        sub_shop_app_id: this.franchiseeId
      },
      success: function(res){
        (listExcludeDelete = goodsList.concat([])).splice(index, 1);
        if(listExcludeDelete.length == 0){
          app.turnBack();
          return;
        }

        that.changeNumTimeout.splice(index, 1);
        that.cart_data_arr.splice(index, 1);
        that.setData({
          goodsList: listExcludeDelete,
          // goodsCount: listExcludeDelete.length,
          exchangeCouponData: {
            dialogHidden: true,
            hasSelectGoods: false,
            voucher_coupon_goods_info: {}
          }
        })
        that.getCalculationPrice(changeGoodNum);
      }
    });
  },
  confirmPayment: function(e){
    var list = this.data.goodsList,
        appointmentTime = this.data.appointmentTime,
        that = this,
        phone = this.data.phone,
        locationId = this.data.locationId;
    if (this.data.wayOfDine == 1 && this.data.changeValue == 1 && !locationId){
      app.showModal({
        content: '请选择位置'
      });
      return;
    }
    if((this.data.shopInfo.is_phone == 1 && !util.isPhoneNumber(phone)) || (phone && this.data.shopInfo.is_phone == 0 && !util.isPhoneNumber(phone))){
      app.showModal({
        content: '请填写正确的手机号码'
      });
      return;
    }
    if (this.data.orderRemark.length > 30) {
      app.showModal({
        content: '备注字数超过限制'
      });
      return;
    }
    if(this.data.wayOfDine == 2){
      if(!appointmentTime){
        app.showModal({
          content: '请选择预约时间'
        });
        return;
      }
      appointmentTime = util.formatTime(new Date()).slice(0, 11) + appointmentTime;
    }
    if (that.isPaysuccessFlag){
      return;
    }
    that.isPaysuccessFlag = true;
    app.sendRequest({
      url: '/index.php?r=AppShop/addCartOrder',
      method: 'post',
      data: {
        cart_arr: this.cart_data_arr,
        formId: e.detail.formId,
        sub_shop_app_id: this.franchiseeId,
        selected_benefit: this.data.selectDiscountInfo,
        tostore_order_type: this.data.wayOfDine,
        tostore_appointment_time: this.data.wayOfDine == 2 ? appointmentTime : '',
        tostore_buyer_phone: this.data.phone,
        tostore_remark: this.data.orderRemark,
        location_id: this.data.wayOfDine == 2 ? '':locationId,
        is_balance: this.data.useBalance ? 1 : 0,
        voucher_coupon_goods_info: this.data.exchangeCouponData.voucher_coupon_goods_info
      },
      success: function(res){
        that.payOrder(res.data);
        app.globalData.tostoreRefresh = true;
      },
      successStatusAbnormal: function(res){
        that.isPaysuccessFlag = false;
        app.showModal({
          content: res.data,
          confirm: function(){
            (res.status == 11 || res.status == 12) && app.turnBack();
          }
        })
      },
      fail:function(){
        that.isPaysuccessFlag = false;
      }
    });
  },
  payOrder: function(orderId){
    var that = this;

    function paySuccess() {
      var pagePath = '/pages/paySuccess/paySuccess?detail=' + orderId + (that.franchiseeId ? '&franchisee='+that.franchiseeId : '');
      if(!that.franchisee_id){
        app.sendRequest({
          hideLoading: true,
          url: '/index.php?r=AppMarketing/CheckAppCollectmeStatus',
          data: {
            'order_id': orderId
          },
          success: function(res){
            if(res.valid == 0) {
              pagePath += '&collectBenefit=1';
            }
            app.turnToPage(pagePath, 1);
          }
        });
      } else {
        app.turnToPage(pagePath, 1);
      }
    }

    function payFail(){
      app.turnToPage('/pages/tostoreOrderDetail/tostoreOrderDetail?detail=' + orderId, 1);
    }

    if(this.data.totalPayment == 0){
      app.sendRequest({
        hideLoading: true,
        url: '/index.php?r=AppShop/paygoods',
        data: {
          order_id: orderId,
          total_price: 0
        },
        success: function(res){
          paySuccess();
        },
        fail: function(){
          payFail();
        },
        successStatusAbnormal: function () {
          payFail();
        }
      });
      return;
    }
    app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppShop/GetWxWebappPaymentCode',
      data: {
        order_id: orderId
      },
      success: function (res) {
        var param = res.data;

        param.orderId = orderId;
        param.goodsType = 3;
        param.success = paySuccess;
        param.fail = payFail;
        that.wxPay(param);
      },
      fail: function(){
        payFail();
      },
      successStatusAbnormal: function () {
        payFail();
      }
    })
  },
  wxPay: function(param){
    var that = this;
    wx.requestPayment({
      'timeStamp': param.timeStamp,
      'nonceStr': param.nonceStr,
      'package': param.package,
      'signType': 'MD5',
      'paySign': param.paySign,
      success: function(res){
        app.wxPaySuccess(param);
        param.success();
      },
      fail: function(res){
        if(res.errMsg === 'requestPayment:fail cancel'){
          param.fail();
          return;
        }
        app.showModal({
          content: '支付失败',
          complete: param.fail
        })
        app.wxPayFail(param, res.errMsg);
      }
    })
  },
  showDiscount: function(){
    this.setData({
      discountDialogHidden: false
    })
  },
  hideDiscount: function(){
    this.setData({
      discountDialogHidden: true
    })
  },
  chooseWayOfDine: function(e){
    var wayOfDine = e.currentTarget.dataset.way,
        that = this;
    this.setData({
      wayOfDine: wayOfDine
    });
    if (wayOfDine == 2){
      this.getTostoreAppointBusinessTime();
      }
  },
  getTostoreAppointBusinessTime: function(){
    var that = this;
      app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppShop/getAvaliableTostoreAppointBusinessTime',
      method: 'post',
      data: {
        good_ids: that.cartGoodsIdArr,
        sub_shop_app_id: that.franchiseeId || '',
      },
      success: function (res) {
        if (res.data.length) {
          var businesssTimeString = '';
          for (var i = 0; i < res.data.length; i++) {
            businesssTimeString += res.data[i].start_time.substring(0, 2) + ':' + res.data[i].start_time.substring(2, 4) + '-' + res.data[i].end_time.substring(0, 2) + ':' + res.data[i].end_time.substring(2, 4) + '/';
          }
          businesssTimeString = '可选时间：' + businesssTimeString.substring(0, businesssTimeString.length - 1);
          that.setData({
            businesssTimeString: businesssTimeString
          })
        }
      }
    })
  },
  bindTimeChange: function(e){
    var time = e.detail.value;
    this.setData({
      appointmentTime: time
    });
  },
  inputPhone: function(e){
    var phone = e.detail.value;
    this.setData({
      phone: phone
    });
    app.setUserInfoStorage({
      phone: phone
    })
  },
  discountChange: function(e){
    var index = e.detail.value,
        that = this;

    setTimeout(function(){
      that.setData({
        selectDiscountInfo: that.data.discountList[index],
        selectDiscountIndex: index,
        discountDialogHidden: true,
        'exchangeCouponData.hasSelectGoods': false,
        'exchangeCouponData.voucher_coupon_goods_info': {}
      })
      that.getCalculationPrice();
    }, 500);
  },
  location:function(e){
    var that = this;
    app.sendRequest({
      url: '/index.php?r=AppShop/locationDataList',
      data: {
        page_size:1000,
        sub_shop_app_id: that.franchiseeId || ''
      },
      success:function(res){
        if (res.data.length){
          that.setData({
            location_data_arr: res.data
          })
        }
      }
    })
  },
  bindLocationChange:function(e){
    var that = this;
    that.setData({
      locationNum:that.data.location_data_arr[e.detail.value].title,
      selectLocationId:that.data.location_data_arr[e.detail.value].id,
      locationId:that.data.location_data_arr[e.detail.value].id,
      locationSelect:true,
      changeValue: 1
    })

  },
  radioLocationChange:function(e){
    var that = this,
        changeValue,
        locationId = '';
     if(e.detail.value == 0){
      locationId = 0;
      changeValue = 0;
    }else if(e.detail.value == 1){
      locationId = that.data.selectLocationId;
      changeValue = 1;
    }else{
      locationId = app.globalData.urlLocationId;
      changeValue = 2;
    }
    that.setData({
      locationId:locationId,
      changeValue: changeValue
    })
  },
  getDataId:function(e){
    var that = this;
    app.sendRequest({
      url: '/index.php?r=AppShop/getLocationData',
      data: {
        id:app.globalData.urlLocationId,
        sub_shop_app_id: that.franchiseeId || ''
      },
      success:function(res){
        that.setData({
          locationTitle:res.data.title
        })
      }
    })
  },
  useBalanceChange: function(e){
    this.setData({
      useBalance: e.detail.value
    });
    this.getCalculationPrice();
  },
  exchangeCouponInit: function(id){
    var that = this;
    app.sendRequest({
      url: '/index.php?r=AppShop/getGoods',
      data: {
        data_id: id
      },
      success: function (res) {
        var goods = res.data[0].form_data;
        var goodsModel = [];
        var selectModelInfo = {
          'models': [],
          'price': 0,
          'modelId': '',
          'models_text': '',
          'imgurl': ''
        };
        if(goods.model_items.length){
          // 有规格
          selectModelInfo['price'] = Number(goods.model_items[0].price);
          selectModelInfo['imgurl'] = goods.model_items[0].img_url;
          selectModelInfo['modelId'] = goods.model_items[0].id;
        } else {
          selectModelInfo['price'] = Number(goods.price);
          selectModelInfo['imgurl'] = goods.cover;
        }
        for(var key in goods.model){
          if(key){
            goodsModel.push(goods.model[key]); // 转成数组
            selectModelInfo['models'].push(goods.model[key].subModelId[0]);
            selectModelInfo['models_text'] += '“' + goods.model[key].subModelName[0] + '” ';
          }
        }
        goods.model = goodsModel; // 将原来的结构转换成数组
        that.setData({
          'exchangeCouponData.dialogHidden': false, // 显示模态框
          'exchangeCouponData.goodsInfo': goods,
          'exchangeCouponData.selectModelInfo': selectModelInfo
        });
      }
    });
  },
  exchangeCouponHideDialog: function(){
    this.setData({
      selectDiscountInfo: this.data.discountList[0],
      selectDiscountIndex: 0,
      'exchangeCouponData.dialogHidden': true,
      'exchangeCouponData.hasSelectGoods': false,
      'exchangeCouponData.voucher_coupon_goods_info': {}
    })
    this.getCalculationPrice();
  },
  exchangeCouponSelectSubModel: function(e){
    var dataset = e.target.dataset,
        modelIndex = dataset.modelIndex,
        submodelIndex = dataset.submodelIndex,
        data = {},
        selectModels = this.data.exchangeCouponData.selectModelInfo.models,
        model = this.data.exchangeCouponData.goodsInfo.model,
        text = '';

    selectModels[modelIndex] = model[modelIndex].subModelId[submodelIndex];

    // 拼已选中规格文字
    for (let i = 0; i < selectModels.length; i++) {
      let selectSubModelId = model[i].subModelId;
      for (let j = 0; j < selectSubModelId.length; j++) {
        if( selectModels[i] == selectSubModelId[j] ){
          text += '“' + model[i].subModelName[j] + '” ';
        }
      }
    }
    data['exchangeCouponData.selectModelInfo.models'] = selectModels;
    data['exchangeCouponData.selectModelInfo.models_text'] = text;

    this.setData(data);
    this.exchangeCouponResetSelectCountPrice();
  },
  exchangeCouponResetSelectCountPrice: function(){
    var that = this,
        selectModelIds = this.data.exchangeCouponData.selectModelInfo.models.join(','),
        modelItems = this.data.exchangeCouponData.goodsInfo.model_items,
        data = {};

    for (var i = modelItems.length - 1; i >= 0; i--) {
      if(modelItems[i].model == selectModelIds){
        data['exchangeCouponData.selectModelInfo.stock'] = modelItems[i].stock;
        data['exchangeCouponData.selectModelInfo.price'] = modelItems[i].price;
        data['exchangeCouponData.selectModelInfo.modelId'] = modelItems[i].id;
        data['exchangeCouponData.selectModelInfo.imgurl'] = modelItems[i].img_url;
        break;
      }
    }
    this.setData(data);
  },
  exchangeCouponConfirmGoods: function(){
    let that = this;
    let goodsInfo = that.data.exchangeCouponData.goodsInfo;
    let model = goodsInfo.model;
    let selectModels = that.data.exchangeCouponData.selectModelInfo.models;
    let model_value_str = '';
    if(selectModels.length > 0){
      model_value_str = '(';
      for (let i = 0; i < selectModels.length; i++) {
        let selectSubModelId = model[i].subModelId;
        for (let j = 0; j < selectSubModelId.length; j++) {
          if( selectModels[i] == selectSubModelId[j] ){
            model_value_str += model[i].subModelName[j] + '|';
          }
        }
      }
      model_value_str += ')';
    }
    goodsInfo['model_value_str'] = model_value_str;
    that.setData({
      'exchangeCouponData.dialogHidden': true,
      'exchangeCouponData.selectModelInfo': {},
      'exchangeCouponData.hasSelectGoods': true,
      'exchangeCouponData.voucher_coupon_goods_info': {
        goods_id: goodsInfo.id,
        num: 1,
        model_id: that.data.exchangeCouponData.selectModelInfo.modelId
      },
      'exchangeCouponData.goodsInfo': goodsInfo
    });
    that.getCalculationPrice();
  },
  GetTostoreWaitingRule: function(){
    let _this = this;
    app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppShop/GetTostoreWaitingRule',
      data: {
        sub_shop_app_id: _this.franchiseeId || ''
      },
      method: 'get',
      success: function (res) {
        let wayOfDine = 1;
        for (let i in res.data.tostore_type) {
          if (res.data.tostore_type[i].tostore_order_type == 2 && res.data.tostore_type[i].use == 1 && res.data.used_tostore_type == 1) {
            wayOfDine = 2;
            setTimeout(function(){
              _this.getTostoreAppointBusinessTime()
            },100); 
          }
        }
        _this.setData({
          shopInfo: res.data,
          wayOfDine: wayOfDine
        })
      }
    });
  }
})
