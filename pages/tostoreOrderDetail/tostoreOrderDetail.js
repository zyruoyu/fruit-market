
var app = getApp()

Page({
  data: {
    orderInfo: {},
    orderStatus: ['待付款', '待商家确认', '商家已确认','待评价','退款审核中','退款中', '已完成','已关闭'],
    addressList: [],
    selectAddressId: '',
    addressDialogHidden: true,
    goodsAdditionalInfo: {},
    hasAdditionalInfo: false,
    customFields: [],
    isFromBack: false,
    orderId: '',
    isFromTemplateMsg: false,
    discountList: '',
    toStoreInfo: {},
    originalPrice: '',
    balance: '',
    useBalance: '',
    freghtSwitch: '',
    delivery: '',
    express_fee: '',
    refund:false,
    applyRefund: false,
    refundType: 0,
    refundMoneyType: 0,
    withdrawRefund: false
  },
  onLoad: function (options) {
    this.setData({
      orderId: options.detail,
      isFromTemplateMsg: options.from === 'template_msg' ? true : false,
      franchiseeId: options.franchisee || ''
    })
    this.dataInitial();
  },
  // 每个页面数据初始化函数 dataInitial
  dataInitial: function () {
    this.getOrderDetail(this.data.orderId);
    this.GetTostoreWaitingRule();
  },
  onShow: function () {
    if (this.data.isFromBack) {
      if (!!this.data.orderInfo.order_id) {
        this.getOrderDetail(this.data.orderInfo.order_id, 1);
      }
    } else {
      this.setData({
        isFromBack: true
      })
    }
  },
  getOrderDetail: function (orderId, isFromAddrSelect) {
    var that = this;
    app.getOrderDetail({
      data: {
        order_id: orderId,
        sub_shop_app_id: that.data.franchiseeId
      },
      success: function (res) {
        var form_data = res.data[0].form_data,
          hasAdditionalInfo = false,
          address_id = '';

        form_data.totalPay = form_data.total_price;

        if (!isFromAddrSelect) {
          for (var i = 0; i < form_data.goods_info.length; i++) {
            var deliveryId = form_data.goods_info[i].delivery_id;
            if (deliveryId && deliveryId != '0') {
              that.getGoodsCustomField(i, deliveryId);
              hasAdditionalInfo = true;
            }
          }
        }

        if (form_data.address_info && that.data.freghtSwitch) {
          address_id = form_data.address_info.address_id;
          that.setData({
            selectAddressId: address_id,
          })
        }
        if (form_data.tostore_data && form_data.tostore_data.appointed_time)
          form_data.tostore_data.format_appointed_time = form_data.tostore_data.appointed_time.substr(11, 5);

        that.setData({
          orderInfo: form_data,
          discountList: form_data.selected_benefit,
          index: form_data.can_use_benefit.selected_index,
          hasAdditionalInfo: hasAdditionalInfo,
          toStoreInfo: form_data.tostore_data,
          benefitPrice: form_data.discount_cut_price,
          balance: Number(res.data[0]['balance']),
          useBalance: form_data['use_balance'],
          express_fee: res.data[0]['express_fee']
        });

      }
    })
  },
  orderDelete: function (e) {
    var orderId = this.data.orderId,
    that = this,
      franchiseeId = this.data.franchiseeId;
    app.showModal({
      content: '订单删除后不可找回，确认删除？',
      showCancel: true,
      cancelText: '取消',
      confirmText: '确定',
      confirm: function () {
        app.sendRequest({
          url: '/index.php?r=AppShop/HideOrder',
          data: {
            order_id: orderId,
            sub_shop_app_id: franchiseeId
          },
          success: function (res) {
            app.turnBack()
          }
        })
      }
    })
  },
  getGoodsCustomField: function (goodsIndex, deliveryId) {
    var that = this;

    app.sendRequest({
      url: '/index.php?r=pc/AppShop/GetDelivery',
      data: {
        app_id: app.getAppId(),
        delivery_id: deliveryId
      },
      success: function (res) {
        var deliveryInfo = res.data.delivery_info,
          goodsId = that.data.orderInfo.goods_info[goodsIndex].goods_id,
          data = {},
          fields = [];
        data['goodsAdditionalInfo.' + goodsId + ''] = deliveryInfo;
        for (var i = 0; i < deliveryInfo.length; i++) {
          var info = {};
          info.type = deliveryInfo[i].type;
          info.title = deliveryInfo[i].name;
          fields.push(info);
        }
        data['customFields[' + goodsIndex + ']'] = fields;
        that.setData(data);
      }
    })
  },
  customFieldInput: function (e) {
    var dataset = e.currentTarget.dataset,
      goodsIndex = dataset.goodsIndex,
      fieldIndex = dataset.fieldIndex,
      value = e.detail.value,
      data = {};

    data['customFields[' + goodsIndex + '][' + fieldIndex + '].value'] = value;
    this.setData(data);
  },
  uploadCustomFieldImage: function (e) {
    var that = this,
      dataset = e.currentTarget.dataset,
      goodsIndex = dataset.goodsIndex,
      fieldIndex = dataset.fieldIndex,
      data = {};

    app.chooseImage(function (paths) {
      data['customFields[' + goodsIndex + '][' + fieldIndex + '].value'] = paths;
      that.setData(data);
    }, 9);
  },
  deleteCustomFieldImage: function (e) {
    var dataset = e.currentTarget.dataset,
      goodsIndex = dataset.goodsIndex,
      fieldIndex = dataset.fieldIndex,
      imageArray = this.data.customFields[goodsIndex][fieldIndex].value,
      imageIndex = dataset.imageIndex,
      data = {};

    imageArray.splice(imageIndex, 1);
    data['customFields[' + goodsIndex + '][' + fieldIndex + '].value'] = imageArray;
    this.setData(data);
  },
  sendDeliveryInfo: function () {
    var additional_info = {},
      goodsInfo = this.data.orderInfo.goods_info;

    for (var i = 0; i < goodsInfo.length; i++) {
      additional_info[goodsInfo[i].goods_id] = this.data.customFields[i];
    }
    app.sendRequest({
      url: '/index.php?r=AppShop/SetAdditional',
      method: 'POST',
      data: {
        order_id: this.data.orderInfo.order_id,
        additional_info: additional_info
      },
      success: function (res) {

      }
    });
  },
  cancelOrder: function (e) {
    var orderId = this.data.orderInfo.order_id,
      that = this;

    app.showModal({
      content: '是否取消订单？',
      showCancel: true,
      confirmText: '是',
      cancelText: '否',
      confirm: function () {
        app.sendRequest({
          url: '/index.php?r=AppShop/cancelOrder',
          data: {
            order_id: orderId,
            sub_shop_app_id: that.data.franchiseeId
          },
          success: function (res) {
            var data = {};

            data['orderInfo.status'] = 7;
            that.setData(data);
          }
        })
      }
    })
  },
  payOrder: function (e) {
    var address_info = this.data.orderInfo.address_info,
      that = this,
      orderId;

    if (!address_info && this.data.orderInfo.goods_type != 3) {
      app.showModal({
        content: '请选择邮寄地址'
      })
      return;
    }

    if (this.data.hasAdditionalInfo) {
      this.sendDeliveryInfo();
    }

    orderId = this.data.orderInfo.order_id;

    if (this.data.orderInfo.totalPay == 0) {
      app.sendRequest({
        url: '/index.php?r=AppShop/paygoods',
        data: {
          order_id: orderId,
          total_price: 0
        },
        success: function (res) {
          app.showToast({
            'title': '支付成功',
            'success': function () {
              that.paySuccessCallback();
            }
          });
        }
      });
      return;
    }

    app.sendRequest({
      url: '/index.php?r=AppShop/GetWxWebappPaymentCode',
      data: {
        order_id: orderId,
        sub_shop_app_id: that.data.franchiseeId
      },
      success: function (res) {
        var param = res.data,
          orderId = that.data.orderInfo.order_id;

        param.orderId = orderId;
        param.goodsType = that.data.orderInfo.goods_type;
        param.success = function () {
          that.paySuccessCallback();
        };
        app.wxPay(param);
      }
    })
  },
  confirmRefund: function(e){
    let type = this.data.refundType;
    /*
        @type ['申请退款', '确认已到店', '撤销退款申请', '收到退款']
    */
    switch(+type){
      case 0:
        this.applyDrawback();
        break;
      case 1:
        this.sureReceipt()
        break;
      case 2:
        this.withdrawRefund();
        break;
      case 3:
        this.receiveDrawback();
        break;
    }
  },
  applyDrawback: function (e) {
    var orderId = this.data.orderInfo.order_id,
        money = this.data.refundMoneyType == 0 ? '' : +this.data.refundMoney,
        that = this;
    if (this.data.refundMoneyType != 0 && !this.data.refundMoney) {
      app.showModal({
        content: '请输入退款金额',
      });
      return;
    }
    if (money && !/^(([1-9][0-9]*)|(([0]\.\d{1,2}|[1-9][0-9]*\.\d{1,2})))$/.test(money) && money == 0 ){
      app.showModal({
        content: '请输入正确的金额',
      });
      return;
    }
    app.sendRequest({
      url: '/index.php?r=AppShop/applyRefund',
      data: {
        refund_price: money,
        order_id: orderId,
        sub_shop_app_id: that.data.franchiseeId
      },
      success: function (res) {
        var data = {};
        data['orderInfo.status'] = 4;
        data['refund'] = false;
        data['orderInfo.refund_info'] = {
          refund_fee: 0,
          refund_balance: +money || +that.data.orderInfo.totalPay + +that.data.useBalance,
        }
        that.setData(data);
      }
    })
  },
  withdrawRefund:function(){
    var that = this;
    app.sendRequest({
      url: '/index.php?r=AppShop/cancelRefund',
      data: {
        order_id: that.data.orderInfo.order_id,
        sub_shop_app_id: that.data.franchiseeId
      },
      success: function (res) {
        var data = {};
        data['orderInfo.status'] = +res.data;
        data['refund'] = false;
        data['refundMoney'] = '';
        data['orderInfo.refund_info'] = '';
        that.setData(data);
      }
    })
  },
  receiveDrawback: function () {
    var orderId = this.data.orderInfo.order_id,
      that = this;

    app.sendRequest({
      url: '/index.php?r=AppShop/comfirmRefund',
      data: {
        order_id: orderId,
        sub_shop_app_id: that.data.franchiseeId
      },
      success: function (res) {
        var data = {};

        data['orderInfo.status'] = 7;
        data['refund'] = false;
        that.setData(data);
      }
    })
  },
  checkLogistics: function () {
    var orderId = this.data.orderInfo.order_id;
    app.turnToPage('/pages/logisticsPage/logisticsPage?detail=' + orderId);
  },
  sureReceipt: function () {
    var orderId = this.data.orderInfo.order_id,
      that = this;
    app.sendRequest({
      url: '/index.php?r=AppShop/comfirmOrder',
      data: {
        order_id: orderId,
        sub_shop_app_id: that.data.franchiseeId
      },
      success: function (res) {
        var data = {};

        data['orderInfo.status'] = 3;
        data['refund'] = false;
        that.setData(data);
      }
    })
    // app.showModal({
    //   content: '确定已收到货物？',
    //   showCancel: true,
    //   confirmText: '确定',
    //   cancelText: '取消',
    //   confirm: function () {

    //   }
    // })
  },
  makeComment: function () {
    var franchiseeId = this.data.franchiseeId,
      pagePath = '/pages/makeComment/makeComment?detail=' + this.data.orderInfo.order_id + (franchiseeId ? '&franchisee=' + franchiseeId : '');
    app.turnToPage(pagePath);
  },
  previewImage: function (e) {
    app.previewImage({
      current: e.currentTarget.dataset.src
    });
  },
  goToHomepage: function () {
    var router = app.getHomepageRouter();
    app.turnToPage('/pages/' + router + '/' + router, true);
  },
  changeDiscount: function (e) {
    var _this = this;
    var index = _this.data.orderInfo.can_use_benefit.selected_index;
    var value = parseInt(e.detail.value);

    this.setData({
      index: value
    });

    var discount_type = _this.data.orderInfo.can_use_benefit.data[value].discount_type,
      coupon_id = _this.data.orderInfo.can_use_benefit.data[value].coupon_id;

    app.sendRequest({
      url: '/index.php?r=AppShop/ChangeOrder',
      data: {
        app_id: app.getAppId(),
        order_id: _this.data.orderInfo.order_id,
        discount_type: discount_type,
        coupon_id: coupon_id,
        sub_shop_app_id: _this.data.franchiseeId
      },
      success: function (res) {
        //console.log(res);
        _this.getOrderDetail(res.data[0].form_data.order_id);
      }
    });
  },
  verificationCode: function () {
    app.turnToPage('/pages/verificationCodePage/verificationCodePage?detail=' + this.data.orderInfo.order_id + '&sub_shop_app_id=' + this.data.franchiseeId);
  },
  changeRefundType:function(e){
    this.setData({
      refundMoneyType: e.detail.value
    })
  },
  refundMoney:function(e){
    this.setData({
      refundMoney: e.detail.value
    })
  },
  refund:function(e){

    this.setData({
      refundMoney:'',
      refund: true,
      refundType: +e.currentTarget.dataset.type
    });
  },
  cancelRefund: function(){
    this.setData({
      refund: false
    });
  },
  customerConfirm: function () {
    var that = this;
    app.sendRequest({
      url: '/index.php?r=AppShop/comfirmOrder',
      data: {
        order_id: this.data.orderInfo.order_id
      },
      success: function () {
        var data = {};
        data['orderInfo.status'] = 3;
        that.setData(data);
      }
    })
  },
  isUseBalance: function (e) {
    var _this = this;
    var isBalance = Number(e.detail.value);
    app.sendRequest({
      url: '/index.php?r=AppShop/ChangeOrder',
      data: {
        app_id: app.getAppId(),
        order_id: _this.data.orderInfo.order_id,
        sub_shop_app_id: _this.data.franchiseeId,
        is_balance: isBalance
      },
      success: function (res) {
        _this.getOrderDetail(res.data[0].form_data.order_id);
      }
    });
  },
  paySuccessCallback: function(){
    let orderId = this.data.orderInfo.order_id;
    let franchiseeId = this.data.franchiseeId;
    let pagePath = '/pages/paySuccess/paySuccess?detail=' + orderId 
                  + (franchiseeId ? '&franchisee=' + franchiseeId : '');
    if(!franchiseeId){
      app.sendRequest({
        url: '/index.php?r=AppMarketing/CheckAppCollectmeStatus',
        data: {
          order_id: orderId
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
  },
  GetTostoreWaitingRule: function () {
    let _this = this;
    app.sendRequest({
      hideLoading: true,
      url: '/index.php?r=AppShop/GetTostoreWaitingRule',
      data: {
        sub_shop_app_id: _this.data.franchiseeId || ''
      },
      method: 'get',
      success: function (res) {
        _this.setData({
          shopInfo: res.data
        })
      }
    });
  },
  makeComment: function () {
    var franchiseeId = this.data.franchiseeId,
      pagePath = '/pages/makeTostoreComment/makeTostoreComment?detail=' + this.data.orderInfo.order_id + (franchiseeId ? '&franchisee=' + franchiseeId : '');
    app.turnToPage(pagePath);
  }
})
