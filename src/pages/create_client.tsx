import { FormHandles } from "@unform/core";
import { Form } from "@unform/web"
import { GetServerSideProps } from "next"
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as Yup from 'yup';
import Input from "../components/Input";
import { MdAdd, MdExpandMore, MdRemove } from 'react-icons/md'

import { Container, Content, AddressContainer, HiddenAddress } from '../styles/pages/create_client'
import getValidationErrors from "../utils/getValidationErrors";
import { CheckBox } from "../components/CheckBox";
import api from "../services/api";
import { verifyCpf } from "../utils/verifyCpf";
import InputWithMask from "../components/InputWithMask";
import cep from 'cep-promise'

interface Address {
  id: number;
  cep: string;
  state: string;
  city: string;
  district: string;
  road: string;
  number: string;
  complement: string;
  type: string;
  is_primary_address: boolean;
  isActive: boolean;
}

interface ClientData {
  name: string;
  cpf: string;
  telephone: string;
  email: string;
  addresses: Address[];
}

export default function Dashboard() {
  const resetedAddress = {
    id: Math.random() * 10,
    cep: '',
    state: '',
    city: '',
    district: '',
    road: '',
    number: '',
    complement: '',
    type: '',
    is_primary_address: true,
    isActive: true
  }

  const [addresses, setAddresses] = useState<Address[]>([resetedAddress])
  const [cepValue, setCepValue] = useState('')
  const [isCepFinded, setIsCepFinded] = useState(false)

  const handleAddAddress = useCallback(() => {
    const newAddress = {
      ...resetedAddress,
      id: Math.random() * 10,
      is_primary_address: false,
    }

    const updatedAddresses = addresses.map(address => address.isActive ? { ...address, isActive: false } : address)

    setAddresses([...updatedAddresses, newAddress])
  }, [addresses])

  const handleExpandAddress = useCallback((addressId: number) => {
    const updatedAddresses = addresses.map(address => address.id !== addressId ? { ...address, isActive: false } : { ...address, isActive: true })

    setAddresses(updatedAddresses)
  }, [addresses])

  const setPrimaryAddress = useCallback((addressId: number) => {
    const updatedAddresses = addresses.map(check => check.id === addressId ? { ...check, is_primary_address: !check.is_primary_address } : { ...check, is_primary_address: false })

    setAddresses(updatedAddresses)
  }, [addresses])

  const handleRemoveAddress = useCallback((addressId: number) => {
    const address = addresses.find(address => address.id === addressId)

    if (address.is_primary_address) {
      alert('Não é possível remover o endereço principal!');
      return;
    }

    const addressesFiltered = addresses.filter(address => address.id !== addressId)

    setAddresses(addressesFiltered.map(address => address.is_primary_address ? { ...address, isActive: true } : address))
  }, [addresses])

  const formRef = useRef<FormHandles>(null);

  const handleSubmit = useCallback(
    async ({ name, cpf, telephone, email }: ClientData) => {
      try {
        formRef.current?.setErrors({});

        const formatData = ({ id, isActive, ...rest }: Address) => rest

        const formattedAddresses = addresses.map(address => formatData(address))


        const formattedData = {
          name,
          cpf,
          telephone,
          email,
          addresses: formattedAddresses
        }

        const schema = Yup.object().shape({
          email: Yup.string()
            .email('Digite um e-mail válido')
            .required('E-mail obrigatório'),
          cpf: Yup.string().required('CPF obrigatório').test(`verify-cpf-is-valid`, 'CPF inválido', function (value) {
            return verifyCpf(value.replace(/\./g, '').replace('-', ''))
          }),
          telephone: Yup.string().required('Telefone obrigatório'),
          name: Yup.string().required('Nome obrigatório'),
          addresses: Yup.array().of(
            Yup.object().shape({
              cep: Yup.string().required('CEP obrigatório'),
              state: Yup.string().required('Estado obrigatório'),
              city: Yup.string().required('Cidade obrigatória'),
              district: Yup.string().required('Bairro obrigatório'),
              road: Yup.string().required('Rua obrigatória'),
              number: Yup.string().required('Número obrigatório'),
              complement: Yup.string().required('Complemento obrigatório'),
              type: Yup.string().required('Tipo obrigatório'),
            })
          )
        });

        await schema.validate(formattedData, {
          abortEarly: false,
        });

        await api.post('/client', formattedData)

        formRef.current.reset()

        setAddresses([{
          ...resetedAddress,
          id: Math.random() * 10,
        }])

      } catch (err) {
        if (err instanceof Yup.ValidationError) {
          const errors = getValidationErrors(err);

          formRef.current?.setErrors(errors);
          return;
        }

        console.log(err)
      }
    },
    [addresses],
  );

  useEffect(() => {
    if(cepValue.includes('_') || cepValue === '') {
      return;
    }

    async function searchCep(): Promise<void> {
      try {
        const checkAddress = addresses.find(address => address.isActive === true)
        const res = await cep(String(checkAddress.cep), { timeout: 200, providers: ['brasilapi'] });

        if (res) {
          const addressWithResponse = {
            ...checkAddress,
            city: res.city,
            district: res.neighborhood,
            state: res.state,
            road: res.street
          }

          setAddresses(addresses.map(address => address.id === checkAddress.id ? addressWithResponse : address))
          setIsCepFinded(true)
        }
      } catch (err) {
        switch (err.type) {
          case "service_error":
            alert("CEP não encontrado");
            break;
          case "validation_error":
            alert("CEP possui um formato inválido");
            break;
          default:
            alert(err.message);
        }
      }
    };

    searchCep()
  }, [cepValue])

  return (

    <Container>
      <Content>
        <Form
          ref={formRef}
          onSubmit={handleSubmit}
        >
          <Input name="name" placeholder="Nome" />
          <InputWithMask mask="999.999.999-99" name="cpf" placeholder="CPF" />
          <InputWithMask mask="(99) 99999-9999" name="telephone" placeholder="Telefone" />
          <Input name="email" placeholder="E-mail" />
          <AddressContainer>
            {addresses.map((address, index) => (
              <div key={address.id}>
                {address.isActive ? (
                  <>
                    <InputWithMask
                      mask="99999-999"
                      name={`addresses[${index}].cep`}
                      placeholder="CEP"
                      value={address.cep}
                      onChange={e => {
                        address.cep = e.target.value
                        const updatedAddresses = [...addresses]
                        setAddresses(updatedAddresses)
                        setCepValue(e.target.value)
                      }}
                    />
                    <Input
                      name={`addresses[${index}].state`}
                      placeholder="Estado"
                      setIsCepFinded={setIsCepFinded}
                      isCepFinded={isCepFinded}
                      value={address.state}
                      onChange={e => {
                        address.state = e.target.value
                        const updatedAddresses = [...addresses]
                        setAddresses(updatedAddresses)
                      }}
                    />
                    <Input
                      name={`addresses[${index}].city`}
                      placeholder="Cidade"
                      setIsCepFinded={setIsCepFinded}
                      isCepFinded={isCepFinded}
                      value={address.city}
                      onChange={e => {
                        address.city = e.target.value
                        const updatedAddresses = [...addresses]
                        setAddresses(updatedAddresses)
                      }}
                    />
                    <Input
                      name={`addresses[${index}].district`}
                      placeholder="Bairro"
                      setIsCepFinded={setIsCepFinded}
                      isCepFinded={isCepFinded}
                      value={address.district}
                      onChange={e => {
                        address.district = e.target.value
                        const updatedAddresses = [...addresses]
                        setAddresses(updatedAddresses)
                      }}
                    />
                    <Input
                      name={`addresses[${index}].road`}
                      placeholder="Rua(Logradouro)"
                      isCepFinded={isCepFinded}
                      setIsCepFinded={setIsCepFinded}
                      value={address.road}
                      onChange={e => {
                        address.road = e.target.value
                        const updatedAddresses = [...addresses]
                        setAddresses(updatedAddresses)
                      }}
                    />
                    <Input
                      name={`addresses[${index}].number`}
                      placeholder="Número"
                      value={address.number}
                      onChange={e => {
                        address.number = e.target.value
                        const updatedAddresses = [...addresses]
                        setAddresses(updatedAddresses)
                      }}
                    />
                    <Input
                      name={`addresses[${index}].complement`}
                      placeholder="Complemento"
                      value={address.complement}
                      onChange={e => {
                        address.complement = e.target.value
                        const updatedAddresses = [...addresses]
                        setAddresses(updatedAddresses)
                      }}
                    />
                    <Input
                      name={`addresses[${index}].type`}
                      placeholder="Tipo(comercial, residencial, rural ou casa de praia)"
                      value={address.type}
                      onChange={e => {
                        address.type = e.target.value
                        const updatedAddresses = [...addresses]
                        setAddresses(updatedAddresses)
                      }}
                    />
                    <span>
                      <CheckBox isChecked={address.is_primary_address} onClick={() => setPrimaryAddress(address.id)} />
                      <p>Endereço Principal</p>
                      <button type="button" onClick={() => handleRemoveAddress(address.id)}>
                        <p>Remover Endereço</p>
                        <MdRemove />
                      </button>
                    </span>
                  </>
                ) : (
                  <HiddenAddress key={address.id}>
                    <p>Endereço {index + 1}</p>
                    <MdExpandMore onClick={() => handleExpandAddress(address.id)} />
                  </HiddenAddress>
                )}
              </div>
            ))}
            <button type="button" onClick={handleAddAddress}>
              <p>Adicionar Endereço</p>
              <MdAdd />
            </button>
          </AddressContainer>
          <button>Cadastrar</button>
        </Form>
      </Content>
    </Container>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {

  const { dribbleChallengeUser, dribbleChallengeToken } = ctx.req.cookies

  if (!dribbleChallengeToken && !dribbleChallengeUser) {
    return {
      redirect: {
        permanent: false,
        destination: '/'
      }
    }
  }

  return {
    props: {
    }
  }
}